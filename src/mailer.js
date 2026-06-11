/**
 * 灵感雷达 - 邮件推送模块
 */

const nodemailer = require('nodemailer');

async function createTransporter() {
  const host = process.env.MAIL_HOST || 'smtp.qq.com';
  const port = parseInt(process.env.MAIL_PORT || '465');
  const user = process.env.MAIL_USER || '';
  const pass = process.env.MAIL_PASS;
  if (!pass) { console.warn('[邮件] ⚠ 未配置 MAIL_PASS，使用 Ethereal 测试邮箱'); return createTestTransporter(); }
  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass }, tls: { rejectUnauthorized: false } });
  try { await transporter.verify(); console.log('[邮件] ✅ SMTP 连接验证成功'); } catch (verifyErr) { console.warn(`[邮件] ⚠ SMTP 连接验证失败: ${verifyErr.message}`); }
  return transporter;
}

async function createTestTransporter() {
  try { const testAccount = await nodemailer.createTestAccount(); return nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, secure: false, auth: { user: testAccount.user, pass: testAccount.pass } }); } catch (err) { console.error('[邮件] 创建测试邮箱失败:', err.message); return null; }
}

function markdownToHtml(markdown) {
  let html = markdown
    .replace(/^#### (.+)$/gm, '<h4 style="margin:12px 0 6px;font-size:14px;color:#666;">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 style="margin:16px 0 8px;font-size:15px;color:#555;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:20px 0 10px;font-size:16px;color:#1a1a1a;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:24px 0 12px;font-size:18px;color:#1a1a1a;">$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#1a73e8;text-decoration:none;">$1</a>')
    .replace(/`(.+?)`/g, '<code style="background:#f0f0f0;padding:1px 5px;border-radius:3px;font-size:13px;">$1</code>')
    .replace(/^[-*] (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin:2px 0;">$2</li>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#999;margin:10px 0;font-size:13px;">$1</blockquote>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">')
    .replace(/\n\n/g, '<br><br>');
  html = html.replace(/(<li style="[^"]*">.*?<\/li>(\n?)){2,}/g, '<ul style="padding-left:20px;margin:8px 0;">$&</ul>');
  return html;
}

function buildHtmlEmail(markdownContent, stats, dateStr) {
  const bodyHtml = markdownToHtml(markdownContent);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;padding:20px;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2c3e50;line-height:1.7}.header{text-align:center;padding:24px 0 8px}.header h1{font-size:20px;font-weight:600;margin:0;color:#1a1a1a}.header .date{font-size:13px;color:#999;margin-top:4px}.card{background:#fff;border-radius:10px;padding:20px;margin:12px 0;box-shadow:0 1px 2px rgba(0,0,0,.04)}.stats{display:flex;gap:10px;justify-content:center;margin:16px 0}.stat{background:#fff;border-radius:8px;padding:12px 18px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.04);min-width:80px}.stat .n{font-size:20px;font-weight:700;color:#1a73e8}.stat .l{font-size:11px;color:#999;margin-top:2px}.footer{text-align:center;margin-top:20px;font-size:11px;color:#bbb}@media(max-width:480px){.card{padding:16px}.header h1{font-size:18px}}</style></head><body><div class="header"><h1>💡 灵感雷达</h1><p class="date">${dateStr}</p></div><div class="stats"><div class="stat"><div class="n">${stats.insightCount}</div><div class="l">有效需求</div></div><div class="stat"><div class="n">${stats.sourceCount}</div><div class="l">来源数</div></div><div class="stat"><div class="n">${stats.platformCount}</div><div class="l">平台数</div></div></div><div class="card">${bodyHtml}</div><div class="footer">🤖 每日自动生成 · ${dateStr}</div></body></html>`;
}

async function sendEmail(subject, markdownContent, plainText, stats = {}) {
  const transporter = await createTransporter();
  if (!transporter) { console.error('[邮件] ❌ 无法创建邮件传输器'); return false; }
  const mailTo = process.env.MAIL_TO || '';
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const htmlContent = buildHtmlEmail(markdownContent, { insightCount: stats.insightCount || 0, sourceCount: stats.sourceCount || 0, platformCount: stats.platformCount || 0 }, dateStr);
  try {
    const info = await transporter.sendMail({ from: `"💡 灵感雷达" <${process.env.MAIL_USER || ''}>`, to: mailTo, subject, text: plainText || markdownContent, html: htmlContent });
    console.log('[邮件] ✅ 邮件发送成功!');
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) { console.log(`[邮件] 📬 预览链接: ${previewUrl}`); }
    return true;
  } catch (err) { console.error(`[邮件] ❌ 邮件发送失败: ${err.message}`); return false; }
}

async function sendDailyReport(markdownReport, plainText, insights = []) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const subject = `💡 灵感雷达 · 每日简报 ${dateStr}`;
  const platforms = new Set(insights.map(i => i.sourcePlatform || '其他'));
  const sources = new Set(insights.map(i => i.sourceUrl).filter(Boolean));
  return await sendEmail(subject, markdownReport, plainText, { insightCount: insights.length, sourceCount: sources.size, platformCount: platforms.size });
}

module.exports = { sendEmail, sendDailyReport };
