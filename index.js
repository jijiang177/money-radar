#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { crawlAll, getMockData } = require('./src/crawler');
const { analyzeWithDeepSeek } = require('./src/ai');
const { generateReport, generatePlainText } = require('./src/reporter');
const { sendDailyReport } = require('./src/mailer');

function todayString(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function createRunId(dateStr = todayString()) {
  return `${dateStr}-${Date.now()}-${process.pid}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonArray(file) {
  if (!fs.existsSync(file)) return [];
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(value) ? value : [];
  } catch (err) {
    console.warn(`[history] Failed to read ${file}: ${err.message}`);
    return [];
  }
}

function readJsonObject(file) {
  if (!fs.existsSync(file)) return {};
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (err) {
    console.warn(`[state] Failed to read ${file}: ${err.message}`);
    return {};
  }
}

function writeHistory(historyFile, history, entry) {
  const withoutToday = history.filter(item => item.date !== entry.date);
  const nextHistory = [...withoutToday, entry].slice(-90);
  fs.writeFileSync(historyFile, JSON.stringify(nextHistory, null, 2), 'utf-8');
  return nextHistory;
}

function shouldSendFormalEmail({ skipMail, dryRun, insightCount, sendState, dateStr, allowDuplicateSend = false }) {
  if (skipMail) return { send: false, reason: 'skip-mail' };
  if (dryRun) return { send: false, reason: 'dry-run' };
  if (!insightCount || insightCount <= 0) return { send: false, reason: 'no-insights' };

  const lastSend = sendState && sendState.lastFormalSend;
  if (!allowDuplicateSend && lastSend && lastSend.date === dateStr && lastSend.status === 'sent') {
    return { send: false, reason: 'already-sent-today', lastSend };
  }

  return { send: true, reason: 'ready' };
}

function markFormalSend(sendStateFile, entry) {
  const state = {
    lastFormalSend: {
      ...entry,
      status: 'sent',
      sentAt: new Date().toISOString(),
    },
  };
  fs.writeFileSync(sendStateFile, JSON.stringify(state, null, 2), 'utf-8');
  return state;
}

async function runRadar(options = {}) {
  const startTime = Date.now();
  const dateStr = todayString();
  const runId = options.runId || process.env.GITHUB_RUN_ID || createRunId(dateStr);
  const triggerSource = options.triggerSource
    || process.env.GITHUB_EVENT_NAME
    || (process.env.GITHUB_ACTIONS === 'true' ? 'github_actions' : 'local');
  const dryRun = Boolean(options.dryRun);

  console.log('');
  console.log('=== Inspiration Radar started ===');
  console.log(`[run] id=${runId} source=${triggerSource} date=${dateStr} dry_run=${dryRun}`);

  try {
    console.log('[1/4] Crawling sources...');
    const rawContents = options.skipCrawl
      ? getMockData()
      : await crawlAll({
          zhihuKeyword: options.zhihuKeyword,
          tiebaKeyword: options.tiebaKeyword,
          useMockData: options.useMockData,
        });
    console.log(`[crawl] Collected ${rawContents.length} raw items.`);

    console.log('[2/4] Analyzing items...');
    const insights = await analyzeWithDeepSeek(rawContents);
    console.log(`[ai] Generated ${insights.length} insights.`);

    console.log('[3/4] Generating report...');
    const dataDir = path.join(__dirname, 'data');
    const reportDir = path.join(__dirname, 'reports');
    ensureDir(dataDir);
    ensureDir(reportDir);

    const historyFile = path.join(dataDir, 'radar_history.json');
    const sendStateFile = options.sendStateFile || path.join(dataDir, 'radar_send_state.json');
    const history = readJsonArray(historyFile);
    const todayKeywords = extractKeywords(insights);
    const trendSummary = buildTrendSummary(todayKeywords, history.slice(-7), dateStr);
    const nextHistory = writeHistory(historyFile, history, {
      date: dateStr,
      insightCount: insights.length,
      topKeywords: todayKeywords.slice(0, 10),
      platformDistribution: getPlatformDist(insights),
    });
    console.log(`[history] Saved ${nextHistory.length} days.`);

    const markdownReport = generateReport(insights, trendSummary);
    const plainText = generatePlainText(insights);
    const reportFile = path.join(reportDir, `brief-${dateStr}.md`);
    fs.writeFileSync(reportFile, markdownReport, 'utf-8');
    console.log(`[report] Saved ${reportFile}`);
    console.log(markdownReport.substring(0, 800));
    if (markdownReport.length > 800) console.log('... report truncated in console');

    const sendDecision = shouldSendFormalEmail({
      skipMail: options.skipMail,
      dryRun,
      insightCount: insights.length,
      sendState: readJsonObject(sendStateFile),
      dateStr,
      allowDuplicateSend: options.allowDuplicateSend,
    });

    if (sendDecision.send) {
      console.log('[4/4] Sending email...');
      const sendResult = await sendDailyReport(markdownReport, plainText, insights);
      if (!sendResult || sendResult.ok !== true) {
        const detail = sendResult?.error || 'Unknown mail error';
        throw new Error(`Daily email was not sent. Mail error: ${detail}`);
      }
      markFormalSend(sendStateFile, {
        date: dateStr,
        runId,
        triggerSource,
        insightCount: insights.length,
        reportFile,
      });
      console.log('[mail] Daily email sent.');
    } else if (sendDecision.reason === 'already-sent-today') {
      console.log(`[4/4] Formal email blocked: already sent for ${dateStr}.`);
    } else if (sendDecision.reason === 'dry-run') {
      console.log('[4/4] Dry run enabled; formal email skipped.');
    } else if (sendDecision.reason === 'no-insights') {
      console.log('[4/4] No valid insights; formal email skipped.');
    } else {
      console.log('[4/4] Email skipped by --skip-mail.');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== Inspiration Radar completed in ${elapsed}s with ${insights.length} insights ===`);
    return { rawContents, insights, markdownReport, reportFile, runId, triggerSource, dryRun, sendDecision };
  } catch (err) {
    console.error(`[radar] Failed: ${err.message}`);
    console.error(err.stack);
    throw err;
  }
}

function extractKeywords(insights) {
  const freq = new Map();
  for (const item of insights || []) {
    const text = `${item.painPoint || ''} ${item.toolIdea || ''}`.toLowerCase();
    const words = text.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
    for (const word of new Set(words)) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }
  }
  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([keyword, count]) => ({ keyword, count }));
}

function getPlatformDist(insights) {
  const dist = {};
  for (const item of insights || []) {
    const platform = item.sourcePlatform || 'other';
    dist[platform] = (dist[platform] || 0) + 1;
  }
  return dist;
}

function buildTrendSummary(todayKeywords, recentDays, todayStr) {
  if (!Array.isArray(recentDays) || recentDays.length === 0) return '';

  const histFreq = new Map();
  for (const day of recentDays) {
    if (day.date === todayStr) continue;
    for (const kw of day.topKeywords || []) {
      histFreq.set(kw.keyword, (histFreq.get(kw.keyword) || 0) + kw.count);
    }
  }

  const days = Math.max(recentDays.filter(day => day.date !== todayStr).length, 1);
  const surges = [];
  for (const kw of todayKeywords || []) {
    const avgDaily = (histFreq.get(kw.keyword) || 0) / days;
    if (kw.count > avgDaily * 2 && kw.count >= 3) surges.push(kw.keyword);
  }

  const histKeys = new Set(histFreq.keys());
  const newKeywords = (todayKeywords || [])
    .filter(kw => !histKeys.has(kw.keyword))
    .slice(0, 5)
    .map(kw => kw.keyword);

  const lines = ['## Trend comparison', ''];
  if (surges.length > 0) lines.push(`- Rising: ${surges.map(k => `\`${k}\``).join(' ')}`);
  if (newKeywords.length > 0) lines.push(`- New: ${newKeywords.map(k => `\`${k}\``).join(' ')}`);
  if (lines.length === 2) lines.push(`- Stable compared with the previous ${days} day(s).`);
  lines.push('');
  return lines.join('\n');
}

function parseArgs(argv) {
  const options = {
    skipMail: argv.includes('--skip-mail'),
    dryRun: argv.includes('--dry-run'),
    skipCrawl: argv.includes('--skip-crawl'),
    useMockData: argv.includes('--use-mock-data'),
    allowDuplicateSend: argv.includes('--allow-duplicate-send'),
  };

  const triggerIdx = argv.indexOf('--trigger-source');
  if (triggerIdx > -1 && argv[triggerIdx + 1]) options.triggerSource = argv[triggerIdx + 1];

  const runIdIdx = argv.indexOf('--run-id');
  if (runIdIdx > -1 && argv[runIdIdx + 1]) options.runId = argv[runIdIdx + 1];

  const zhihuIdx = argv.indexOf('--zhihu-keyword');
  if (zhihuIdx > -1 && argv[zhihuIdx + 1]) options.zhihuKeyword = argv[zhihuIdx + 1];

  const tiebaIdx = argv.indexOf('--tieba-keyword');
  if (tiebaIdx > -1 && argv[tiebaIdx + 1]) options.tiebaKeyword = argv[tiebaIdx + 1];

  return options;
}

if (require.main === module) {
  runRadar(parseArgs(process.argv.slice(2))).catch(() => {
    process.exit(1);
  });
}

module.exports = {
  runRadar,
  extractKeywords,
  getPlatformDist,
  buildTrendSummary,
  parseArgs,
  todayString,
  createRunId,
  readJsonObject,
  shouldSendFormalEmail,
  markFormalSend,
};
