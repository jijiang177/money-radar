const webhookUrlArg = process.argv.find(arg => arg.startsWith('--url='));
const webhookUrl = webhookUrlArg ? webhookUrlArg.slice('--url='.length) : process.env.DATA_WEBHOOK_URL;

if (!webhookUrl) {
  console.error('DATA_WEBHOOK_URL is missing. Set it locally or pass --url=<webhook-url>.');
  process.exit(1);
}

const basePayload = {
  schemaVersion: 'mvp-event-v1',
  productSlug: 'competitor-price-radar-mvp',
  source: 'manual_webhook_test',
  createdAt: new Date().toISOString()
};

const samples = [
  {
    ...basePayload,
    type: 'event',
    eventName: 'page_view',
    path: '/',
    payload: { label: 'webhook test page view' },
    storageFile: 'events.jsonl'
  },
  {
    ...basePayload,
    type: 'event',
    eventName: 'cta_click',
    path: '/',
    payload: { label: 'webhook test CTA' },
    storageFile: 'events.jsonl'
  },
  {
    ...basePayload,
    type: 'waitlist_submit',
    email: 'webhook-test@example.com',
    sourcePath: '/',
    storageFile: 'waitlist.jsonl'
  },
  {
    ...basePayload,
    type: 'feedback_submit',
    rating: 5,
    message: 'Webhook test feedback from competitor price radar MVP.',
    email: 'webhook-test@example.com',
    sourcePath: '/',
    storageFile: 'feedback.jsonl'
  }
];

async function postSample(sample) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...sample,
      receivedAt: new Date().toISOString()
    })
  });

  if (!response.ok) {
    throw new Error(`${sample.type} failed with HTTP ${response.status}`);
  }

  return sample.type === 'event' ? sample.eventName : sample.type;
}

(async () => {
  const results = [];
  for (const sample of samples) {
    results.push(await postSample(sample));
  }

  console.log('Webhook test passed.');
  console.log(`Sent ${results.length} sample records: ${results.join(', ')}`);
})();
