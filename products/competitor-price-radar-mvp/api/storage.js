const fs = require('fs');
const os = require('os');
const path = require('path');

function getDataDir() {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'competitor-price-radar-mvp-data');
  }

  return path.join(process.cwd(), 'data');
}

function appendJsonl(fileName, record) {
  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  fs.appendFileSync(path.join(dataDir, fileName), `${JSON.stringify(record)}\n`, 'utf-8');
}

async function postWebhook(url, payload) {
  if (!url || typeof fetch !== 'function') return false;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}`);
  }

  return true;
}

async function persistRecord(fileName, record, webhookUrl) {
  appendJsonl(fileName, record);
  const webhookStored = await postWebhook(webhookUrl, record).catch(error => {
    console.warn(`Webhook delivery skipped: ${error.message}`);
    return false;
  });

  return {
    ok: true,
    fileStored: true,
    webhookStored
  };
}

module.exports = {
  persistRecord
};
