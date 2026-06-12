const axios = require('axios');

const INTERNATIONAL_SOURCES = {
  HACKER_NEWS: 'Hacker News',
  REDDIT: 'Reddit',
};

const RESERVED_SOURCES = [
  'Product Hunt',
  'GitHub Trending',
  'Google Trends',
  'YouTube',
  'X',
  'App Store',
];

function getRandomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

function includesAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

function inferInternationalDemandStrength({ title = '', content = '', score = 0, comments = 0, source = '' }) {
  const text = `${title} ${content}`.toLowerCase();
  let demandScore = 0;

  if (includesAny(text, ['how do you', 'anyone using', 'looking for', 'recommend', 'alternative', 'pain', 'problem', 'need'])) demandScore += 2;
  if (includesAny(text, ['built', 'launched', 'show hn', 'side project', 'saas', 'automation'])) demandScore += 1;
  if (includesAny(text, ['pricing', 'competitor', 'customers', 'revenue', 'paid', 'subscription'])) demandScore += 2;
  if (score >= 50 || comments >= 20) demandScore += 2;
  else if (score >= 10 || comments >= 5) demandScore += 1;
  if (source.includes('Reddit')) demandScore += 1;

  if (demandScore >= 5) return { label: '高', score: demandScore };
  if (demandScore >= 3) return { label: '中', score: demandScore };
  return { label: '低', score: demandScore };
}

function inferInternationalPain(title, content) {
  const text = `${title}. ${content || ''}`.trim();
  if (!text) return '海外用户出现了一个待验证需求信号，需要继续观察原帖上下文。';
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function inferInternationalOpportunity(title, content) {
  const text = `${title} ${content}`.toLowerCase();

  if (includesAny(text, ['competitor', 'pricing', 'price tracking'])) return '竞品价格和功能自动监控报告工具';
  if (includesAny(text, ['customer interview', 'customer interviews', 'product requirements', 'user research'])) return '用户访谈记录转产品需求文档工具';
  if (includesAny(text, ['spreadsheet', 'google sheets', 'csv', 'airtable'])) return '把表格快速发布成业务小应用的轻量工具';
  if (includesAny(text, ['newsletter', 'digest', 'summary', 'summarize'])) return '面向垂直主题的 AI 摘要和邮件简报工具';
  if (includesAny(text, ['clipboard', 'bookmark', 'history', 'search'])) return '个人知识片段和剪贴板智能搜索工具';
  if (includesAny(text, ['resume', 'interview', 'job', 'hiring'])) return '面向海外求职场景的简历/面试准备工具';
  if (includesAny(text, ['api', 'developer', 'github', 'code'])) return '开发者工作流自动化小工具';

  return '围绕该海外需求信号做一个轻量 AI 表单工具';
}

function inferPaymentPotential(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  if (includesAny(text, ['pricing', 'revenue', 'customers', 'paid', 'subscription', 'b2b', 'saas', 'competitor'])) return '高';
  if (includesAny(text, ['productivity', 'automation', 'developer', 'business', 'job'])) return '中';
  return '待验证';
}

function inferMvpSuggestion(title, content) {
  const opportunity = inferInternationalOpportunity(title, content);
  const text = `${title} ${content}`.toLowerCase();

  if (includesAny(text, ['competitor', 'pricing'])) return '先做一个输入竞品 URL 列表、输出价格/功能变化表的报告生成器';
  if (includesAny(text, ['customer interview', 'customer interviews', 'product requirements', 'user research'])) return '先做一个粘贴访谈记录、输出痛点/需求/优先级的英文表单工具';
  if (includesAny(text, ['spreadsheet', 'csv', 'google sheets'])) return '先做一个上传 CSV 或粘贴表格链接、生成只读展示页的单页工具';
  if (includesAny(text, ['summary', 'newsletter', 'digest'])) return '先做一个输入信息源 URL、自动生成每日英文摘要邮件的最小版本';
  if (includesAny(text, ['clipboard', 'bookmark'])) return '先做一个本地文本/链接导入后可语义搜索的静态原型';

  return `先做一个英文落地页 + 表单版 MVP，验证“${opportunity}”是否有人愿意留下邮箱`;
}

function normalizeInternationalSignal({
  source,
  title,
  content = '',
  url,
  createdAt,
  score = 0,
  comments = 0,
  signalType = 'international-discussion',
}) {
  const demand = inferInternationalDemandStrength({ title, content, score, comments, source });
  const productOpportunity = inferInternationalOpportunity(title, content);
  const userPain = inferInternationalPain(title, content);
  const paymentPotential = inferPaymentPotential(title, content);
  const mvpSuggestion = inferMvpSuggestion(title, content);

  return {
    platform: source,
    source,
    title,
    originalTitle: title,
    content: userPain,
    url,
    link: url,
    createdAt: createdAt || new Date().toISOString(),
    market: 'international',
    radarSource: 'international',
    signalType,
    userPain,
    painPoint: userPain,
    productOpportunity,
    toolIdea: productOpportunity,
    internationalDemandStrength: demand.label,
    internationalDemandScore: demand.score,
    willingnessToPay: paymentPotential,
    mvpSuggestion,
    mvpDirection: mvpSuggestion,
    sourceScore: score,
    sourceComments: comments,
  };
}

async function crawlHackerNewsSignals() {
  console.log('[国际雷达] 抓取 Hacker News Ask/Show...');
  const results = [];

  try {
    const [askResp, showResp] = await Promise.allSettled([
      axios.get('https://hacker-news.firebaseio.com/v0/askstories.json', { timeout: 10000 }),
      axios.get('https://hacker-news.firebaseio.com/v0/showstories.json', { timeout: 10000 }),
    ]);

    const ids = [
      ...(askResp.status === 'fulfilled' ? (askResp.value.data || []).slice(0, 8) : []),
      ...(showResp.status === 'fulfilled' ? (showResp.value.data || []).slice(0, 8) : []),
    ];

    const items = await Promise.allSettled(
      ids.map(id => axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 8000 }))
    );

    for (const result of items) {
      if (result.status !== 'fulfilled') continue;
      const item = result.value.data;
      if (!item?.title) continue;

      const source = item.url ? 'Hacker News Show' : 'Hacker News Ask';
      results.push(normalizeInternationalSignal({
        source,
        title: item.title,
        content: item.text || '',
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        createdAt: new Date(item.time * 1000).toISOString(),
        score: item.score || 0,
        comments: item.descendants || 0,
        signalType: item.url ? 'product-launch' : 'user-question',
      }));
    }
  } catch (err) {
    console.warn(`[国际雷达] Hacker News 抓取失败: ${err.message}`);
  }

  console.log(`  ✅ Hacker News 国际信号: ${results.length} 条`);
  return results;
}

async function crawlRedditSignals() {
  console.log('[国际雷达] 抓取 Reddit SideProject/SaaS...');
  const results = [];
  const subreddits = ['SideProject', 'SaaS'];

  for (const sub of subreddits) {
    try {
      const resp = await axios.get(
        `https://www.reddit.com/r/${sub}/hot.json?limit=8`,
        { headers: { 'User-Agent': getRandomUserAgent() }, timeout: 10000 }
      );
      const posts = resp.data?.data?.children || [];
      for (const post of posts) {
        const data = post.data;
        if (!data?.title || data.stickied) continue;

        results.push(normalizeInternationalSignal({
          source: `Reddit/r/${sub}`,
          title: data.title,
          content: data.selftext || data.title,
          url: `https://reddit.com${data.permalink}`,
          createdAt: new Date(data.created_utc * 1000).toISOString(),
          score: data.score || 0,
          comments: data.num_comments || 0,
          signalType: 'community-discussion',
        }));
      }
    } catch (err) {
      console.warn(`[国际雷达] Reddit/r/${sub} 抓取失败: ${err.message}`);
    }
  }

  console.log(`  ✅ Reddit 国际信号: ${results.length} 条`);
  return results;
}

function getMockInternationalSignals() {
  return [
    normalizeInternationalSignal({
      source: 'Hacker News Ask',
      title: 'Ask HN: What tools do you use to monitor competitor pricing?',
      content: 'I run a small SaaS and checking competitor pricing manually every week is becoming annoying.',
      url: 'https://news.ycombinator.com/item?id=mock-international-1',
      score: 72,
      comments: 31,
      signalType: 'user-question',
    }),
    normalizeInternationalSignal({
      source: 'Reddit/r/SaaS',
      title: 'I need a lightweight way to turn customer interview notes into product requirements',
      content: 'Most product management tools feel too heavy for a solo founder. I just want structured insights and next steps.',
      url: 'https://reddit.com/r/SaaS/mock-international-2',
      score: 44,
      comments: 18,
      signalType: 'community-discussion',
    }),
  ];
}

async function crawlInternationalSignals(options = {}) {
  const tasks = [
    crawlHackerNewsSignals(),
    crawlRedditSignals(),
  ];
  const settled = await Promise.allSettled(tasks);
  const signals = settled.flatMap(result => (
    result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []
  ));

  if (signals.length === 0 && options.useMockData) {
    console.log('[国际雷达] 国际源不可用，使用 mock 国际信号');
    return getMockInternationalSignals();
  }

  return signals;
}

module.exports = {
  INTERNATIONAL_SOURCES,
  RESERVED_SOURCES,
  normalizeInternationalSignal,
  inferInternationalDemandStrength,
  crawlHackerNewsSignals,
  crawlRedditSignals,
  crawlInternationalSignals,
  getMockInternationalSignals,
};
