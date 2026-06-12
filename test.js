const assert = require('assert');

process.env.MAIL_RETRY_BASE_DELAY = '1';

const { parseAIResponse } = require('./src/ai');
const { collectSettledResults, dedupeItems } = require('./src/crawler');
const { sendDailyReport, sendEmail, getMissingEmailEnv } = require('./src/mailer');
const { enrichProductOpportunity, getTopOpportunities } = require('./src/opportunity');
const { generateReport, generatePlainText } = require('./src/reporter');
const { parseArgs, shouldSendFormalEmail, supplementInsights, buildRunSummary } = require('./index');

async function testEmptyInsightsSkipEmail() {
  const sent = await sendDailyReport('# Empty', 'Empty', []);
  assert.strictEqual(sent, false, 'empty insights should not send a formal email');
}

function testSingleSourceFailureContinues() {
  const items = collectSettledResults([
    { status: 'rejected', reason: new Error('source failed') },
    { status: 'fulfilled', value: [{ title: 'ok', url: 'https://example.com/a', platform: 'ok' }] },
  ]);
  assert.strictEqual(items.length, 1, 'fulfilled source should still be collected');
  assert.strictEqual(items[0].title, 'ok');
}

function testMalformedAIResponseDoesNotCrash() {
  assert.deepStrictEqual(parseAIResponse('not json'), []);
  assert.deepStrictEqual(parseAIResponse('{"painPoint":"x"}'), []);
  assert.deepStrictEqual(parseAIResponse('```json\n{"bad":true}\n```'), []);
}

async function testMailFailureHasClearResult() {
  const errors = [];
  const originalError = console.error;
  console.error = message => errors.push(String(message));
  const oldMailTo = process.env.MAIL_TO;
  process.env.MAIL_TO = 'receiver@example.com';
  try {
    let attempts = 0;
    const sent = await sendEmail(
      'Test',
      '# Test',
      'Test',
      { insightCount: 1, sourceCount: 1, platformCount: 1 },
      {
        maxRetries: 2,
        transporter: {
          async sendMail() {
            attempts += 1;
            throw new Error('smtp down');
          },
        },
      }
    );
    assert.strictEqual(sent.ok, false, 'sendEmail should return a failed result after retry exhaustion');
    assert.strictEqual(sent.error, 'smtp down', 'sendEmail should return the final SMTP error');
    assert.strictEqual(attempts, 2, 'sendEmail should retry failed sends');
    assert(errors.some(line => line.includes('Send attempt 1/2 failed')), 'failure log should include retry attempt');
    assert(errors.some(line => line.includes('Email send failed after retries')), 'failure log should include final error');
  } finally {
    console.error = originalError;
    if (oldMailTo === undefined) delete process.env.MAIL_TO;
    else process.env.MAIL_TO = oldMailTo;
  }
}

function testDuplicateNewsAreDeduped() {
  const items = dedupeItems([
    { title: 'Same title', url: 'https://example.com/a?utm_source=x', platform: 'A' },
    { title: 'Same title changed', url: 'https://example.com/a?utm_source=y', platform: 'A' },
    { title: 'No URL', platform: 'B' },
    { title: '  no   url ', platform: 'B' },
  ]);
  assert.strictEqual(items.length, 2, 'duplicates should be removed by normalized URL or title');
}

function testMissingEnvIsExplicit() {
  const missing = getMissingEmailEnv({ MAIL_USER: 'sender@example.com' });
  assert.deepStrictEqual(missing, ['MAIL_PASS', 'MAIL_TO']);
}

function testDryRunBlocksFormalEmail() {
  const decision = shouldSendFormalEmail({
    skipMail: false,
    dryRun: true,
    insightCount: 3,
    sendState: {},
    dateStr: '2026-06-12',
  });
  assert.deepStrictEqual(decision, { send: false, reason: 'dry-run' });
}

function testSameDaySendIsBlocked() {
  const decision = shouldSendFormalEmail({
    skipMail: false,
    dryRun: false,
    insightCount: 3,
    dateStr: '2026-06-12',
    sendState: {
      lastFormalSend: {
        date: '2026-06-12',
        status: 'sent',
        runId: 'already-sent',
      },
    },
  });
  assert.strictEqual(decision.send, false);
  assert.strictEqual(decision.reason, 'already-sent-today');
}

function testRunArgsAreParsed() {
  const options = parseArgs([
    '--dry-run',
    '--trigger-source',
    'workflow_dispatch',
    '--run-id',
    '12345',
  ]);
  assert.strictEqual(options.dryRun, true);
  assert.strictEqual(options.triggerSource, 'workflow_dispatch');
  assert.strictEqual(options.runId, '12345');
}

function testInsightsAreSupplementedWhenTooFew() {
  const existing = [{
    painPoint: 'Need one dashboard',
    toolIdea: 'Build one dashboard',
    sourceUrl: 'https://example.com/one',
    sourcePlatform: 'AI',
  }];
  const raw = [
    { title: 'Need app for invoices', content: 'Need app tool for invoices', url: 'https://example.com/one', platform: 'Raw' },
    { title: 'Need app for notes', content: 'Need app tool for notes', url: 'https://example.com/two', platform: 'Raw' },
    { title: 'Need app for budget', content: 'Need app tool for budget', url: 'https://example.com/three', platform: 'Raw' },
  ];
  const result = supplementInsights(existing, raw, 3);
  assert.strictEqual(result.insights.length, 3);
  assert.strictEqual(result.added, 2);
}

function testRunSummaryIncludesSourceStats() {
  const summary = buildRunSummary({
    rawCount: 10,
    aiCount: 1,
    finalCount: 5,
    fallbackCount: 4,
    sourceDistribution: { V2EX: 6, HackerNews: 4 },
  });
  assert(summary.includes('原始抓取：10 条'));
  assert(summary.includes('AI筛选：1 条'));
  assert(summary.includes('V2EX: 6 条'));
}

function testProductOpportunityFieldsAreAdded() {
  const item = enrichProductOpportunity({
    painPoint: '每周写周报太痛苦，要翻聊天记录和邮件，浪费时间。',
    toolIdea: '做一个周报生成器 H5，输入关键词自动生成周报模板',
    sourcePlatform: 'V2EX',
  });

  assert(item.productOpportunity, 'product opportunity should be present');
  assert(item.targetUser, 'target user should be present');
  assert(item.existingSolutionGap, 'solution gap should be present');
  assert(item.mvpDirection.includes('周报') || item.mvpDirection.includes('表单'), 'MVP direction should be concrete');
  assert(['建议做', '观察', '暂不做'].includes(item.recommendation), 'recommendation should be normalized');
}

function testTravelBudgetOpportunityStaysTravelFocused() {
  const item = enrichProductOpportunity({
    painPoint: '每次规划旅游都要看好几个 app，预算、时间、景点、住宿都要自己算，太累了。',
    toolIdea: '做一个旅游预算规划 H5，输入预算和天数，自动推荐路线和住宿方案',
    sourcePlatform: '贴吧',
  });

  assert(item.productOpportunity.includes('旅游') || item.mvpDirection.includes('路线'), 'travel signal should stay travel-focused');
  assert(item.mvpDirection.includes('预算'), 'MVP should keep the budget planning angle');
}

function testProductOpportunityReportFormat() {
  const insights = [
    enrichProductOpportunity({
      painPoint: '客户跟进很随意，线索经常流失。',
      toolIdea: '做一个销售跟进话术生成器',
      sourcePlatform: '知乎',
      sourceUrl: 'https://example.com/sales',
    }),
    enrichProductOpportunity({
      painPoint: '买东西要在多个平台来回比价，太麻烦。',
      toolIdea: '做一个多平台比价查询 H5',
      sourcePlatform: '贴吧',
    }),
  ];

  const top = getTopOpportunities(insights, 1);
  assert.strictEqual(top.length, 1);
  assert(Number.isFinite(top[0].opportunityScore), 'top opportunity should have score');

  const report = generateReport(insights);
  assert(report.includes('产品机会雷达 · 每日报告'));
  assert(report.includes('今日 Top 5 产品机会'));
  assert(report.includes('建议'));
  assert(report.includes('最小 MVP'));
  assert(report.includes('付费可能'));

  const plainText = generatePlainText(insights);
  assert(plainText.includes('今日 Top 5 产品机会'));
  assert(plainText.includes('MVP'));
}

async function main() {
  testSingleSourceFailureContinues();
  testMalformedAIResponseDoesNotCrash();
  testDuplicateNewsAreDeduped();
  testMissingEnvIsExplicit();
  testDryRunBlocksFormalEmail();
  testSameDaySendIsBlocked();
  testRunArgsAreParsed();
  testInsightsAreSupplementedWhenTooFew();
  testRunSummaryIncludesSourceStats();
  testProductOpportunityFieldsAreAdded();
  testTravelBudgetOpportunityStaysTravelFocused();
  testProductOpportunityReportFormat();
  await testEmptyInsightsSkipEmail();
  await testMailFailureHasClearResult();
  console.log('All tests passed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
