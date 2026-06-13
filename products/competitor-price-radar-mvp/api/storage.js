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

function getWebhookUrls(specificWebhookUrl) {
  return Array.from(new Set([
    process.env.DATA_WEBHOOK_URL,
    specificWebhookUrl
  ].filter(Boolean)));
}

function getStorageStatus() {
  return {
    mode: process.env.VERCEL ? 'vercel-temp-file' : 'local-file',
    durableWebhookConfigured: Boolean(
      process.env.DATA_WEBHOOK_URL ||
      process.env.EVENT_WEBHOOK_URL ||
      process.env.WAITLIST_WEBHOOK_URL ||
      process.env.FEEDBACK_WEBHOOK_URL
    )
  };
}

async function persistRecord(fileName, record, webhookUrl) {
  appendJsonl(fileName, record);
  const webhookPayload = {
    ...record,
    schemaVersion: 'mvp-event-v1',
    storageFile: fileName,
    receivedAt: new Date().toISOString()
  };
  const webhookResults = await Promise.all(getWebhookUrls(webhookUrl).map(url =>
    postWebhook(url, webhookPayload).catch(error => {
      console.warn(`Webhook delivery skipped: ${error.message}`);
      return false;
    })
  ));

  return {
    ok: true,
    fileStored: true,
    webhookStored: webhookResults.some(Boolean)
  };
}

module.exports = {
  getStorageStatus,
  persistRecord
};
