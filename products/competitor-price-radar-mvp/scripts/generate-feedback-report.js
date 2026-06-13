const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const reportsDir = path.join(root, 'reports');
const daysArg = process.argv.find(arg => arg.startsWith('--days='));
const days = daysArg ? Number(daysArg.split('=')[1]) : 7;
const now = new Date();
const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

function readJsonl(fileName) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function inRange(record) {
  const createdAt = new Date(record.createdAt || 0);
  return createdAt >= since && createdAt <= now;
}

function percent(numerator, denominator) {
  if (!denominator) return '0.0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function dateKey(value) {
  return new Date(value || Date.now()).toISOString().slice(0, 10);
}

function countByDay(records) {
  return records.reduce((acc, record) => {
    const key = dateKey(record.createdAt);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function average(records, field) {
  const values = records.map(record => Number(record[field])).filter(Number.isFinite);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function chooseDecision(metrics) {
  if (metrics.visits === 0) {
    return {
      status: '暂无判断',
      codex: '暂不建议继续消耗 Codex 额度',
      nextStep: '先补一个明确流量入口，例如朋友圈、社群、Reddit、Product Hunt 或冷启动邮件。'
    };
  }

  if (metrics.emailConversion >= 0.05 || metrics.feedbackCount >= 3 || metrics.averageRating >= 4) {
    return {
      status: '继续',
      codex: '值得继续消耗少量 Codex 额度',
      nextStep: '围绕反馈里最高频的痛点，做一个最小真实功能，不要扩展成完整系统。'
    };
  }

  if (metrics.visits >= 50 && metrics.ctaRate < 0.03 && metrics.emailConversion < 0.01) {
    return {
      status: '放弃或重做定位',
      codex: '不建议继续消耗 Codex 额度',
      nextStep: '先重写标题、痛点和目标用户，或者换一个产品机会。'
    };
  }

  return {
    status: '迭代观察',
    codex: '只建议消耗很少 Codex 额度做文案或 Demo 调整',
    nextStep: '先改首屏价值主张和 CTA，再跑一周数据。'
  };
}

const events = readJsonl('events.jsonl').filter(inRange);
const waitlist = readJsonl('waitlist.jsonl').filter(inRange);
const feedback = readJsonl('feedback.jsonl').filter(inRange);
const pageViews = events.filter(event => event.eventName === 'page_view');
const ctaClicks = events.filter(event => event.eventName === 'cta_click');
const demoRuns = events.filter(event => event.eventName === 'demo_run');
const feedbackEvents = events.filter(event => event.eventName === 'feedback_submit');
const productSlugs = new Set([
  ...events.map(record => record.productSlug),
  ...waitlist.map(record => record.productSlug),
  ...feedback.map(record => record.productSlug)
].filter(Boolean));

const metrics = {
  periodDays: days,
  generatedAt: now.toISOString(),
  products: Array.from(productSlugs),
  visits: pageViews.length,
  ctaClicks: ctaClicks.length,
  demoRuns: demoRuns.length,
  waitlistSubmissions: waitlist.length,
  feedbackCount: feedback.length,
  feedbackEvents: feedbackEvents.length,
  averageRating: Number(average(feedback, 'rating').toFixed(1)),
  dailyVisits: countByDay(pageViews)
};

metrics.ctaRate = metrics.visits ? metrics.ctaClicks / metrics.visits : 0;
metrics.emailConversion = metrics.visits ? metrics.waitlistSubmissions / metrics.visits : 0;
metrics.feedbackConversion = metrics.visits ? metrics.feedbackCount / metrics.visits : 0;
metrics.decision = chooseDecision(metrics);

const dailyTrend = Object.entries(metrics.dailyVisits)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([day, count]) => `| ${day} | ${count} |`)
  .join('\n') || '| 暂无 | 0 |';

const feedbackLines = feedback.slice(-5).reverse().map(item => {
  const text = item.message.length > 80 ? `${item.message.slice(0, 80)}...` : item.message;
  return `- ${item.rating}/5：${text}`;
}).join('\n') || '- 暂无反馈';

const markdown = `# 产品表现周报

生成时间：${metrics.generatedAt}
统计周期：最近 ${metrics.periodDays} 天
产品：${metrics.products.join(', ') || '未识别'}

## 核心问题

- 有没有人访问？${metrics.visits > 0 ? `有，${metrics.visits} 次访问。` : '没有。'}
- 有没有人点击？${metrics.ctaClicks > 0 ? `有，${metrics.ctaClicks} 次 CTA 点击。` : '没有。'}
- 有没有人留下邮箱？${metrics.waitlistSubmissions > 0 ? `有，${metrics.waitlistSubmissions} 个邮箱。` : '没有。'}
- 哪个产品机会值得继续？${metrics.decision.status === '继续' ? '当前机会值得继续。' : '当前机会还需要继续验证或调整定位。'}
- 是否值得继续消耗 Codex 额度？${metrics.decision.codex}
- 是否应该放弃？${metrics.decision.status === '放弃或重做定位' ? '建议放弃当前表达方式，或换一个机会。' : '暂不直接放弃。'}
- 下一步最小迭代是什么？${metrics.decision.nextStep}

## 指标

| 指标 | 数值 |
| --- | ---: |
| 页面访问 | ${metrics.visits} |
| CTA 点击 | ${metrics.ctaClicks} |
| Demo 使用 | ${metrics.demoRuns} |
| 邮箱提交 | ${metrics.waitlistSubmissions} |
| 用户反馈 | ${metrics.feedbackCount} |
| 平均反馈评分 | ${metrics.averageRating} |
| CTA 点击率 | ${percent(metrics.ctaClicks, metrics.visits)} |
| 邮箱转化率 | ${percent(metrics.waitlistSubmissions, metrics.visits)} |
| 反馈转化率 | ${percent(metrics.feedbackCount, metrics.visits)} |

## 每日访问趋势

| 日期 | 访问 |
| --- | ---: |
${dailyTrend}

## 最近反馈

${feedbackLines}

## 结论

推荐动作：${metrics.decision.status}

${metrics.decision.nextStep}
`;

fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(path.join(reportsDir, 'product-performance-weekly.md'), markdown, 'utf-8');
fs.writeFileSync(path.join(reportsDir, 'product-performance-weekly.json'), JSON.stringify(metrics, null, 2), 'utf-8');

console.log(markdown);
