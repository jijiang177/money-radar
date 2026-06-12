const nodemailer = require('nodemailer');

const MAIL_MAX_RETRIES = Number(process.env.MAIL_MAX_RETRIES || 3);
const MAIL_RETRY_BASE_DELAY = Number(process.env.MAIL_RETRY_BASE_DELAY || 1000);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getMissingEmailEnv(env = process.env) {
  return ['MAIL_USER', 'MAIL_PASS', 'MAIL_TO'].filter(name => !env[name]);
}

async function createTransporter() {
  const host = process.env.MAIL_HOST || 'smtp.qq.com';
  const port = Number(process.env.MAIL_PORT || 465);
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  const missing = getMissingEmailEnv();

  if (process.env.GITHUB_ACTIONS === 'true' && missing.length > 0) {
    throw new Error(`Missing required email environment variables: ${missing.join(', ')}`);
  }

  if (!pass) {
    console.warn('[mail] MAIL_PASS is not configured; using an Ethereal test inbox.');
    return createTestTransporter();
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.verify();
    console.log('[mail] SMTP connection verified.');
  } catch (err) {
    console.warn(`[mail] SMTP verification failed; send will still be attempted: ${err.message}`);
  }

  return transporter;
}

async function createTestTransporter() {
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log(`[mail] Created Ethereal test inbox: ${testAccount.user}`);
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  } catch (err) {
    console.error(`[mail] Failed to create test inbox: ${err.message}`);
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function markdownToHtml(markdown) {
  return escapeHtml(markdown)
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((https?:\/\/.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function buildHtmlEmail(markdownContent, stats, dateStr) {
  const bodyHtml = markdownToHtml(markdownContent);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:20px; background:#f0f2f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#2c3e50; line-height:1.7; }
    .header { text-align:center; padding:24px 0 8px; }
    .header h1 { font-size:20px; font-weight:600; margin:0; color:#1a1a1a; }
    .header .date { font-size:13px; color:#999; margin-top:4px; }
    .stats { display:flex; gap:10px; justify-content:center; margin:16px 0; }
    .stat { background:#fff; border-radius:8px; padding:12px 18px; text-align:center; box-shadow:0 1px 2px rgba(0,0,0,.04); min-width:80px; }
    .stat .n { font-size:20px; font-weight:700; color:#1a73e8; }
    .stat .l { font-size:11px; color:#999; margin-top:2px; }
    .card { background:#fff; border-radius:10px; padding:20px; margin:12px 0; box-shadow:0 1px 2px rgba(0,0,0,.04); }
    .card a { color:#1a73e8; text-decoration:none; }
    .footer { text-align:center; margin-top:20px; font-size:11px; color:#bbb; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Inspiration Radar</h1>
    <p class="date">${escapeHtml(dateStr)}</p>
  </div>
  <div class="stats">
    <div class="stat"><div class="n">${stats.insightCount}</div><div class="l">Insights</div></div>
    <div class="stat"><div class="n">${stats.sourceCount}</div><div class="l">Sources</div></div>
    <div class="stat"><div class="n">${stats.platformCount}</div><div class="l">Platforms</div></div>
  </div>
  <div class="card">${bodyHtml}</div>
  <div class="footer">Generated automatically on ${escapeHtml(dateStr)}</div>
</body>
</html>`;
}

async function sendMailWithRetry(transporter, mailOptions, maxRetries = MAIL_MAX_RETRIES) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (err) {
      lastError = err;
      console.error(`[mail] Send attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await sleep(MAIL_RETRY_BASE_DELAY * (2 ** (attempt - 1)));
      }
    }
  }
  throw lastError;
}

async function sendEmail(subject, markdownContent, plainText, stats = {}, options = {}) {
  const transporter = options.transporter || await createTransporter();
  if (!transporter) {
    console.error('[mail] Unable to create email transporter.');
    return { ok: false, error: 'Unable to create email transporter.' };
  }

  const mailTo = process.env.MAIL_TO;
  if (!mailTo) {
    console.error('[mail] Missing MAIL_TO; email was not sent.');
    return { ok: false, error: 'Missing MAIL_TO.' };
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const htmlContent = buildHtmlEmail(markdownContent, {
    insightCount: stats.insightCount || 0,
    sourceCount: stats.sourceCount || 0,
    platformCount: stats.platformCount || 0,
  }, dateStr);

  try {
    const info = await sendMailWithRetry(transporter, {
      from: `"Inspiration Radar" <${process.env.MAIL_USER || mailTo}>`,
      to: mailTo,
      subject,
      text: plainText || markdownContent,
      html: htmlContent,
    }, options.maxRetries ?? MAIL_MAX_RETRIES);

    console.log('[mail] Email sent successfully.');
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`[mail] Preview URL: ${previewUrl}`);
    return { ok: true, info };
  } catch (err) {
    console.error(`[mail] Email send failed after retries: ${err.message}`);
    return { ok: false, error: err.message, code: err.code, responseCode: err.responseCode };
  }
}

async function sendDailyReport(markdownReport, plainText, insights = []) {
  if (!Array.isArray(insights) || insights.length === 0) {
    console.warn('[mail] No insights generated; formal daily email was skipped.');
    return false;
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const subject = `Inspiration Radar Daily Brief - ${dateStr}`;
  const platforms = new Set(insights.map(i => i.sourcePlatform || 'other'));
  const sources = new Set(insights.map(i => i.sourceUrl).filter(Boolean));

  return sendEmail(subject, markdownReport, plainText, {
    insightCount: insights.length,
    sourceCount: sources.size,
    platformCount: platforms.size,
  });
}

module.exports = {
  sendEmail,
  sendDailyReport,
  sendMailWithRetry,
  getMissingEmailEnv,
  markdownToHtml,
  buildHtmlEmail,
};
