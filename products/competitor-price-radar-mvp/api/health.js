const { getStorageStatus } = require('./storage');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    productSlug: 'competitor-price-radar-mvp',
    storage: getStorageStatus(),
    checkedAt: new Date().toISOString()
  }));
};
