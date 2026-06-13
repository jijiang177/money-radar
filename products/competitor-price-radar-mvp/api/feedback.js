const { persistRecord } = require('./storage');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  try {
    const body = await readBody(req);
    const message = String(body.message || '').trim();
    const rating = Number(body.rating || 0);

    if (!message || rating < 1 || rating > 5) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Valid feedback required' }));
      return;
    }

    const record = {
      type: 'feedback_submit',
      rating,
      message,
      email: String(body.email || '').trim().toLowerCase(),
      productSlug: body.productSlug || 'mvp-template',
      sourcePath: body.sourcePath || '',
      referrer: body.referrer || '',
      userAgent: req.headers['user-agent'] || '',
      createdAt: body.createdAt || new Date().toISOString()
    };

    await persistRecord('feedback.jsonl', record, process.env.FEEDBACK_WEBHOOK_URL);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Feedback logging failed' }));
  }
};
