const SPREADSHEET_ID = 'PASTE_SPREADSHEET_ID_HERE';

const SHEETS = {
  events: 'Events',
  waitlist: 'Waitlist',
  feedback: 'Feedback'
};

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'competitor-price-radar-mvp-google-sheet-webhook'
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = parsePayload_(e);
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const target = appendPayload_(spreadsheet, payload);

    return jsonResponse_({
      ok: true,
      target,
      type: payload.type || '',
      eventName: payload.eventName || ''
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  } finally {
    lock.releaseLock();
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Missing request body');
  }

  return JSON.parse(e.postData.contents);
}

function appendPayload_(spreadsheet, payload) {
  if (payload.type === 'waitlist_submit') {
    spreadsheet.getSheetByName(SHEETS.waitlist).appendRow([
      value_(payload.receivedAt),
      value_(payload.createdAt),
      value_(payload.productSlug),
      value_(payload.type),
      value_(payload.email),
      value_(payload.sourcePath),
      value_(payload.referrer),
      value_(payload.userAgent),
      value_(payload.storageFile),
      value_(payload.schemaVersion)
    ]);
    return SHEETS.waitlist;
  }

  if (payload.type === 'feedback_submit') {
    spreadsheet.getSheetByName(SHEETS.feedback).appendRow([
      value_(payload.receivedAt),
      value_(payload.createdAt),
      value_(payload.productSlug),
      value_(payload.type),
      value_(payload.rating),
      value_(payload.message),
      value_(payload.email),
      value_(payload.sourcePath),
      value_(payload.referrer),
      value_(payload.userAgent),
      value_(payload.storageFile),
      value_(payload.schemaVersion)
    ]);
    return SHEETS.feedback;
  }

  spreadsheet.getSheetByName(SHEETS.events).appendRow([
    value_(payload.receivedAt),
    value_(payload.createdAt),
    value_(payload.productSlug),
    value_(payload.type),
    value_(payload.eventName),
    value_(payload.path),
    value_(payload.referrer),
    value_(payload.payload && payload.payload.label),
    value_(payload.email || (payload.payload && payload.payload.email)),
    payload.payload ? JSON.stringify(payload.payload) : '',
    value_(payload.userAgent),
    value_(payload.storageFile),
    value_(payload.schemaVersion)
  ]);
  return SHEETS.events;
}

function value_(value) {
  if (value === null || value === undefined) return '';
  return value;
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
