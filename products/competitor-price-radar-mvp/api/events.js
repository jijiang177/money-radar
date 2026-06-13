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
    const record = {
      type: 'event',
      eventName: body.eventName || 'unknown',
      productSlug: body.productSlug || 'mvp-template',
      path: body.path || '',
      referrer: body.referrer || '',
      payload: body.payload || {},
      userAgent: req.headers['user-agent'] || '',
      createdAt: body.createdAt || new Date().toISOString()
    };

    await persistRecord('events.jsonl', record, process.env.EVENT_WEBHOOK_URL);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Event logging failed' }));
  }
};
