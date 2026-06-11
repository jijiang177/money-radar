/**
 * 灵感雷达 - 爬虫模块
 * 多源信息采集：Bing搜索 / Hacker News / Product Hunt / Reddit / GitHub Trending
 * 知乎热榜 / V2EX / 掘金 / 36kr / 百度热搜
 */

const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const SEARCH_QUERIES = [
  { site: 'site:zhihu.com/question', keywords: '"有没有那种" "工具"', platform: '知乎' },
  { site: 'site:zhihu.com/question', keywords: '"求推荐" "工具" "好用"', platform: '知乎' },
  { site: 'site:tieba.baidu.com/p', keywords: '"求推荐一个" "软件"', platform: '贴吧' },
  { site: 'site:tieba.baidu.com/p', keywords: '"有没有" "小程序"', platform: '贴吧' },
  { site: 'site:xiaohongshu.com', keywords: '"求推荐" "好用" "软件"', platform: '小红书' },
  { site: 'site:xiaohongshu.com', keywords: '"太好用了" "工具"', platform: '小红书' },
  { site: 'site:douyin.com', keywords: '"太好用" "神器"', platform: '抖音' },
  { site: 'www', keywords: '"搞钱" "小工具" "需求"', platform: '全网' },
  { site: 'www', keywords: '"副业" "工具" "推荐"', platform: '全网' },
];

async function crawlHackerNews() {
  console.log('[爬虫] 抓取 Hacker News...');
  const results = [];
  try {
    const idsResp = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json', { timeout: 10000 });
    const ids = (idsResp.data || []).slice(0, 15);
    const items = await Promise.allSettled(ids.map(id => axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 8000 })));
    for (const r of items) {
      if (r.status !== 'fulfilled') continue;
      const item = r.value.data;
      if (!item || !item.title) continue;
      results.push({ platform: 'HackerNews', title: item.title, content: item.text ? item.text.substring(0, 400) : '', url: item.url || `https://news.ycombinator.com/item?id=${item.id}`, createdAt: new Date(item.time * 1000).toISOString() });
    }
    console.log(`  ✅ HackerNews: ${results.length} 条`);
  } catch (err) { console.warn(`  [HN] 抓取失败: ${err.message}`); }
  return results;
}

async function crawlHNAskShow() {
  console.log('[爬虫] 抓取 HN Ask/Show...');
  const results = [];
  try {
    const [askResp, showResp] = await Promise.allSettled([
      axios.get('https://hacker-news.firebaseio.com/v0/askstories.json', { timeout: 10000 }),
      axios.get('https://hacker-news.firebaseio.com/v0/showstories.json', { timeout: 10000 }),
    ]);
    const ids = [...(askResp.status === 'fulfilled' ? (askResp.value.data || []).slice(0, 8) : []), ...(showResp.status === 'fulfilled' ? (showResp.value.data || []).slice(0, 8) : [])];
    const items = await Promise.allSettled(ids.map(id => axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 8000 })));
    for (const r of items) {
      if (r.status !== 'fulfilled') continue;
      const item = r.value.data;
      if (!item || !item.title) continue;
      const isAsk = item.type === 'story' && !item.url;
      results.push({ platform: isAsk ? 'HN Ask' : 'HN Show', title: item.title, content: item.text ? item.text.substring(0, 400) : '', url: item.url || `https://news.ycombinator.com/item?id=${item.id}`, createdAt: new Date(item.time * 1000).toISOString() });
    }
    console.log(`  ✅ HN Ask/Show: ${results.length} 条`);
  } catch (err) { console.warn(`  [HN Ask/Show] 抓取失败: ${err.message}`); }
  return results;
}

async function crawlProductHunt() {
  console.log('[爬虫] 抓取 Product Hunt...');
  const results = [];
  try {
    const resp = await axios.post('https://api.producthunt.com/v2/api/graphql', { query: '{ posts(first: 10, order: RANKING) { edges { node { id name tagline description url createdAt } } } }' }, { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, timeout: 10000 }).catch(() => null);
    if (resp?.data?.data?.posts?.edges) {
      for (const edge of resp.data.data.posts.edges) {
        const n = edge.node;
        results.push({ platform: 'ProductHunt', title: `${n.name} - ${n.tagline}`, content: n.description ? n.description.substring(0, 400) : n.tagline, url: n.url, createdAt: n.createdAt });
      }
    }
    console.log(`  ✅ ProductHunt: ${results.length} 条`);
  } catch (err) { console.warn(`  [PH] 抓取失败: ${err.message}`); }
  return results;
}

async function crawlReddit() {
  console.log('[爬虫] 抓取 Reddit 创意板块...');
  const results = [];
  const subs = ['SideProject', 'startups', 'SaaS'];
  for (const sub of subs) {
    try {
      const resp = await axios.get(`https://www.reddit.com/r/${sub}/hot.json?limit=8`, { headers: { 'User-Agent': getRandomUA() }, timeout: 10000 });
      const posts = resp.data?.data?.children || [];
      for (const p of posts) {
        const d = p.data;
        if (!d.title || d.stickied) continue;
        results.push({ platform: `Reddit/r/${sub}`, title: d.title, content: d.selftext ? d.selftext.substring(0, 400) : d.title, url: `https://reddit.com${d.permalink}`, createdAt: new Date(d.created_utc * 1000).toISOString() });
      }
    } catch (err) { console.warn(`  [Reddit/r/${sub}] 抓取失败: ${err.message}`); }
  }
  console.log(`  ✅ Reddit: ${results.length} 条`);
  return results;
}

async function crawlGithubTrending() {
  console.log('[爬虫] 抓取 GitHub Trending...');
  const results = [];
  try {
    const resp = await axios.get('https://api.github.com/search/repositories?q=stars:>100+pushed:>2025-01-01&sort=stars&order=desc&per_page=10', { headers: { 'Accept': 'application/vnd.github+json' }, timeout: 10000 });
    const items = resp.data?.items || [];
    for (const item of items) { results.push({ platform: 'GitHub Trending', title: item.name, content: item.description || '', url: item.html_url, createdAt: item.pushed_at }); }
    console.log(`  ✅ GitHub: ${results.length} 条`);
  } catch (err) { console.warn(`  [GitHub] 抓取失败: ${err.message}`); }
  return results;
}

async function crawlIndieHackers() {
  console.log('[爬虫] 抓取 Indie Hackers...');
  const results = [];
  try {
    const resp = await axios.get('https://www.indiehackers.com/posts/top.json', { headers: { 'User-Agent': getRandomUA() }, timeout: 10000 });
    const posts = (resp.data || []).slice(0, 12);
    for (const p of posts) { const title = p.title || ''; if (title) results.push({ platform: 'Indie Hackers', title: title, content: (p.description || p.tagline || '').substring(0, 300), url: p.url || `https://www.indiehackers.com/post/${p.id}`, createdAt: p.published_at || new Date().toISOString() }); }
    console.log(`  ✅ Indie Hackers: ${results.length} 条`);
  } catch (err) { console.warn(`  [IH] 抓取失败: ${err.message}`); }
  return results;
}

async function crawlZhihuHotList() {
  console.log('[爬虫] 抓取知乎热榜...');
  const results = [];
  try {
    const resp = await axios.get('https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=10', { headers: { 'User-Agent': getRandomUA(), 'Referer': 'https://www.zhihu.com/hot' }, timeout: 15000 });
    const data = resp.data;
    if (data?.data) {
      for (const item of data.data) {
        const t = item.target || {};
        const title = t.title || '';
        if (title) { results.push({ platform: '知乎热榜', title: title.replace(/<[^>]*>/g, ''), content: (t.excerpt || t.description || '').replace(/<[^>]*>/g, '').substring(0, 300), url: (t.url || '').startsWith('http') ? t.url : `https://www.zhihu.com/question/${t.id}`, createdAt: new Date().toISOString() }); }
      }
    }
    console.log(`  ✅ 知乎热榜: ${results.length} 条`);
  } catch (err) { console.warn(`  [热榜] 知乎: ${err.message}`); }
  return results;
}

async function crawlV2ex() {
  console.log('[爬虫] 抓取 V2EX 热门...');
  const results = [];
  try {
    const resp = await axios.get('https://www.v2ex.com/api/topics/hot.json', { headers: { 'User-Agent': getRandomUA() }, timeout: 15000 });
    if (Array.isArray(resp.data)) {
      for (const item of resp.data) {
        const title = (item.title || '').replace(/<[^>]*>/g, '');
        if (title) { results.push({ platform: 'V2EX', title: title, content: (item.content || item.content_rendered || '').replace(/<[^>]*>/g, '').substring(0, 300), url: item.url || `https://www.v2ex.com/t/${item.id}`, createdAt: new Date().toISOString() }); }
      }
    }
    console.log(`  ✅ V2EX: ${results.length} 条`);
  } catch (err) { console.warn(`  [V2EX] 抓取失败: ${err.message}`); }
  return results;
}

async function crawlJuejin() {
  console.log('[爬虫] 抓取 掘金热榜...');
  const results = [];
  const categories = ['frontend', 'backend', 'ai'];
  for (const cat of categories) {
    try {
      const resp = await axios.post('https://api.juejin.cn/content_api/v1/content/article_rank', { category_id: cat, type: 'hot' }, { headers: { 'Content-Type': 'application/json', 'User-Agent': getRandomUA() }, timeout: 10000 });
      const items = resp.data?.data || [];
      for (const item of items.slice(0, 5)) {
        const info = item.content || item.content_info || {};
        const title = info.title || item.title || '';
        if (title) { results.push({ platform: '掘金', title: title, content: (info.brief || info.description || '').substring(0, 300), url: `https://juejin.cn/post/${info.article_id || item.id || ''}`, createdAt: new Date().toISOString() }); }
      }
    } catch (err) { console.warn(`  [掘金/${cat}] 抓取失败: ${err.message}`); }
  }
  console.log(`  ✅ 掘金: ${results.length} 条`);
  return results;
}

async function crawl36kr() {
  console.log('[爬虫] 抓取 36kr 快讯...');
  const results = [];
  try {
    const resp = await axios.get('https://www.36kr.com/api/search?q=创业 工具 产品&per_page=10', { headers: { 'User-Agent': getRandomUA() }, timeout: 10000 });
    const items = resp.data?.data?.items || [];
    for (const item of items) {
      const title = item.title || item.post?.title || '';
      if (title) { results.push({ platform: '36kr', title: title.replace(/<[^>]*>/g, ''), content: (item.summary || item.post?.summary || '').replace(/<[^>]*>/g, '').substring(0, 300), url: item.url || item.post?.url || '', createdAt: new Date().toISOString() }); }
    }
    console.log(`  ✅ 36kr: ${results.length} 条`);
  } catch (err) { console.warn(`  [36kr] 抓取失败: ${err.message}`); }
  return results;
}

async function crawlBaiduHot() {
  console.log('[爬虫] 抓取百度热搜...');
  const results = [];
  try {
    const resp = await axios.get('https://top.baidu.com/api/board?tab=realtime', { headers: { 'User-Agent': getRandomUA() }, timeout: 10000 });
    const items = resp.data?.data?.cards?.[0]?.content || [];
    for (const item of items.slice(0, 10)) {
      if (item.word || item.query) { results.push({ platform: '百度热搜', title: item.word || item.query, content: item.desc || '', url: item.url || item.schema || '', createdAt: new Date().toISOString() }); }
    }
    console.log(`  ✅ 百度热搜: ${results.length} 条`);
  } catch (err) { console.warn(`  [百度] 抓取失败: ${err.message}`); }
  return results;
}

async function searchBing(query, platform) {
  const results = [];
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=5`;
      const resp = await axios.get(searchUrl, { headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8', 'Referer': 'https://www.bing.com/' }, timeout: 15000 });
      const $ = cheerio.load(resp.data);
      $('.b_algo').each((i, el) => {
        if (results.length >= 5) return false;
        const titleEl = $(el).find('h2 a');
        const snippetEl = $(el).find('.b_caption p');
        const title = titleEl.text().trim();
        const url = titleEl.attr('href') || '';
        const snippet = snippetEl.text().trim();
        if (url.includes('ad.doubleclick') || title.includes('广告')) return;
        if (title && url) { results.push({ platform, title, content: snippet || title, url, createdAt: new Date().toISOString() }); }
      });
      if (results.length > 0 || attempt === 3) { console.log(`  [Bing] "${query.substring(0, 30)}..." → ${results.length} 条`); return results; }
      console.warn(`  [Bing] 搜索返回 0 条 (尝试 ${attempt}/3)`);
    } catch (err) { lastError = err; console.warn(`  [Bing] 搜索失败 (尝试 ${attempt}/3): ${err.message}`); }
    if (attempt < 3) { await new Promise(r => setTimeout(r, 2000)); }
  }
  console.warn(`  [Bing] "${query.substring(0, 30)}..." 最终失败: ${lastError?.message || '0 条结果'}`);
  return results;
}

async function crawlAll(options = {}) {
  console.log('════════════════════════════════════════');
  console.log('  🔍 灵感雷达 - 多元信息源扫描');
  console.log('  🌍 中文平台 + 全球 API + 科技媒体');
  console.log('════════════════════════════════════════');
  const allResults = [];
  const tasks = [];
  console.log('\n📡 [策略一] Bing 搜索引擎...');
  for (const q of SEARCH_QUERIES) { tasks.push(searchBing(`${q.site} ${q.keywords}`, q.platform)); }
  console.log('\n🌍 [策略二] 全球公开 API...');
  tasks.push(crawlHackerNews(), crawlHNAskShow(), crawlProductHunt(), crawlReddit(), crawlGithubTrending(), crawlIndieHackers());
  console.log('\n📊 [策略三] 中文热榜 & 科技媒体...');
  tasks.push(crawlZhihuHotList(), crawlV2ex(), crawlJuejin(), crawl36kr(), crawlBaiduHot());
  const taskResults = await Promise.allSettled(tasks);
  for (const result of taskResults) { if (result.status === 'fulfilled' && Array.isArray(result.value)) { allResults.push(...result.value); } }
  const seen = new Set();
  const unique = [];
  for (const item of allResults) { if (item.url && !seen.has(item.url)) { seen.add(item.url); unique.push(item); } }
  const sourceCount = {};
  for (const item of unique) { sourceCount[item.platform] = (sourceCount[item.platform] || 0) + 1; }
  console.log(`\n📊 来源分布:`, JSON.stringify(sourceCount));
  if (unique.length === 0) { return getMockData(); }
  return unique;
}

function getMockData() {
  console.log('[爬虫] 所有数据源不可用，使用模拟数据');
  return [
    { platform: '知乎', title: '有没有什么工具可以快速对比不同平台的商品价格？', content: '每次买东西都要在淘宝、京东、拼多多之间来回切换比价，太麻烦了。有没有一个工具能一次性查完所有平台的价格？', url: 'https://www.zhihu.com/question/m1', createdAt: new Date().toISOString() },
    { platform: '贴吧', title: '有没有那种输入预算就能自动推荐旅游路线的工具？', content: '每次规划旅游都要看好几个app，预算、时间、景点、住宿都要自己算，太累了。', url: 'https://tieba.baidu.com/p/m2', createdAt: new Date().toISOString() },
    { platform: 'HackerNews', title: 'Show HN: I built a tool that turns spreadsheets into web apps', content: 'No-code tool for turning Google Sheets into fully functional web applications without writing a single line of code.', url: 'https://news.ycombinator.com/item?id=m3', createdAt: new Date().toISOString() },
    { platform: 'Reddit/r/SideProject', title: 'I automated competitor research and got 200 signups in 24h', content: 'Built a simple tool that scrapes competitor pricing and features, generates a comparison report.', url: 'https://reddit.com/r/SideProject/m4', createdAt: new Date().toISOString() },
    { platform: 'ProductHunt', title: 'ClipboardManager - Smart clipboard history with AI search', content: 'Never lose a copied link again. AI-powered semantic search across your clipboard history.', url: 'https://producthunt.com/posts/m5', createdAt: new Date().toISOString() },
    { platform: 'V2EX', title: '有没有自动生成周报的工具？每周写周报太痛苦了', content: '每周写周报太痛苦了，要是有个工具能根据聊天记录和邮件自动生成周报就好了。', url: 'https://www.v2ex.com/t/m6', createdAt: new Date().toISOString() },
  ];
}

module.exports = { crawlAll };
