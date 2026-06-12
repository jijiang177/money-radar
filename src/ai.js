/**
 * 搞钱需求雷达 - AI 痛点提炼模块
 */

const axios = require('axios');

const AI_MAX_RETRIES = 3;
const AI_RETRY_BASE_DELAY = 1000;

async function callAIWithRetry(payload, apiKey) {
  let lastError;
  for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      const resp = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        { ...payload, model: process.env.DEEPSEEK_MODEL || 'deepseek-chat' },
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 60000,
        }
      );
      return resp.data;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      if (status && status < 500) break;
      if (attempt < AI_MAX_RETRIES) {
        const delay = AI_RETRY_BASE_DELAY * (2 ** (attempt - 1));
        console.warn(`  [AI] 重试 ${attempt}/${AI_MAX_RETRIES}，等待 ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

function parseAIResponse(reply) {
  if (!reply || typeof reply !== 'string') return [];
  try { return normalizeAIInsights(JSON.parse(reply)); } catch {}
  const codeMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) try { return normalizeAIInsights(JSON.parse(codeMatch[1].trim())); } catch {}
  const arrayMatch = reply.match(/\[[\s\S]*\]/);
  if (arrayMatch) try { return normalizeAIInsights(JSON.parse(arrayMatch[0])); } catch {}
  return [];
}

function normalizeAIInsights(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item =>
    item &&
    typeof item === 'object' &&
    typeof item.painPoint === 'string' &&
    typeof item.toolIdea === 'string' &&
    Number.isFinite(Number(item.sourceIndex))
  );
}

async function processBatch(batch, apiKey) {
  const contentText = batch.map((item, i) =>
    `[${i + 1}] 平台: ${item.platform}\n标题: ${item.title}\n内容: ${item.content}\n链接: ${item.url}`
  ).join('\n---\n');

  const systemPrompt = `你是一个资深产品经理 + 独立开发者，专门识别适合「周末项目」或「微型 SaaS」的用户真实需求。

你的判断标准（每个需求 0-5 分，≥3 分才输出）：
1. 是否可用纯前端（H5/网页/微信小程序）实现？(+2)
2. 是否有明确的目标用户群？（+1）
3. 是否有变现路径？（广告/订阅/一次性付费/流量主）(+1)
4. 是否需要复杂后端/数据库/支付？(-1 每项)
5. 是否属于"个人能搞"的范围？（不需要团队或大量资金）(+1)

额外规则：
- 如果内容像是 AI 生成的营销软文、灌水帖、或没有实质需求信息，跳过
- 同一个编号可以输出多条不重复的需求
- 需求描述要具体，不要泛泛而谈（比如不要说"做个工具提升效率"，要说"做个给前端开发的智能颜色搭配工具"）

先在心里分类，再输出 JSON：

请严格按照以下 JSON 格式回复（只返回 JSON 数组，不要其他文字）：
[
  {
    "painPoint": "用户具体的痛点描述",
    "toolIdea": "建议做的微型 H5 工具描述（要具体到功能）",
    "category": "工具类型（如：生活效率/开发者工具/学习教育/数据工具/内容创作/金融理财/其他）",
    "sourceIndex": 对应内容的编号（1-${batch.length}）,
    "score": 0-5 分,
    "reason": "评分理由 + 变现方式"
  }
]

如果确实没有任何有价值的需求（score < 3），返回 []`;

  const data = await callAIWithRetry({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请分析以下用户讨论内容，识别出可以被做成微型 H5 工具的需求：\n\n${contentText}` }
    ],
    temperature: 0.5,
    max_tokens: 2000,
  }, apiKey);

  const reply = data.choices[0].message.content;
  console.log(`  [AI] 响应: ${reply.substring(0, 120)}...`);

  const batchInsights = parseAIResponse(reply);
  return batchInsights.map(item => {
    const source = batch[item.sourceIndex - 1] || {};
    return {
      painPoint: item.painPoint,
      toolIdea: item.toolIdea,
      category: item.category || '其他',
      score: item.score ?? 0,
      reason: item.reason || '',
      sourceTitle: source.title || '',
      sourceContent: source.content || '',
      sourceUrl: source.url || '',
      sourcePlatform: source.platform || '',
    };
  });
}

async function analyzeWithDeepSeek(rawContents) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn('[AI] ⚠ 未配置 DEEPSEEK_API_KEY，使用本地规则过滤');
    return localFilter(rawContents);
  }

  console.log(`[AI] 开始分析 ${rawContents.length} 条内容...`);
  console.log('[AI] 第一步：本地规则预过滤...');
  const preFiltered = preFilter(rawContents);
  console.log(`[AI] 预过滤: ${rawContents.length} -> ${preFiltered.length} 条`);

  if (preFiltered.length === 0) {
    console.log('[AI] 预过滤后无内容，跳过 API 调用');
    return [];
  }

  console.log('[AI] 第二步：DeepSeek 深度分析（并行批量）...');
  const BATCH_SIZE = 10;
  const batches = [];
  for (let i = 0; i < preFiltered.length; i += BATCH_SIZE) {
    batches.push(preFiltered.slice(i, i + BATCH_SIZE));
  }

  console.log(`[AI] 分 ${batches.length} 批并行调用 API...`);
  const batchResults = await Promise.allSettled(
    batches.map(async (batch, idx) => {
      console.log(`[AI] bot 启动第 ${idx + 1}/${batches.length} 批 (${batch.length} 条)...`);
      const insights = await processBatch(batch, apiKey);
      console.log(`  第 ${idx + 1} 批识别出 ${insights.length} 个需求`);
      return insights;
    })
  );

  const allInsights = [];
  for (const result of batchResults) {
    if (result.status === 'fulfilled') allInsights.push(...result.value);
  }

  console.log(`[AI] 分析完成，共识别出 ${allInsights.length} 个有效需求`);
  return allInsights;
}

function preFilter(rawContents) {
  const titleDemandKeywords = ['有没有', '想要', '求推荐', '求一个', '太麻烦', '求', '推荐', '好用', '工具', '软件', 'app', '小程序'];
  const demandKeywords = ['有没有', '想要', '求推荐', '求一个', '太麻烦', '不方便', '需要', '太难了', '痛苦', '浪费时间', '效率低', '复杂', '不会', '不懂', '怎么', '如何', '找不到', '没有', '推荐', '好用', '工具', 'app', '软件', '小程序', '网站', '查询', '计算', '生成', '测试', '对比', '统计', '记录', '提醒', '搜索', '分析', '转换', '预算', '规划', '管理', '自动', '简单', '快速', '方便'];
  const adKeywords = ['加微信', 'qq群', '付费课程', '限时优惠', '点击链接'];
  const dictionaryKeywords = ['汉语文字', '汉字', '拼音', '部首', '笔顺', '组词', '释义', '新华字典', '汉辞宝', '汉语国学', '汉语查', '汉典', '百度百科', '字的意思', '字的拼音', '字的部首', '笔画', '多音字', '五笔', '字形', '造字法'];

  const results = [];
  for (const item of rawContents) {
    const title = item.title || '';
    const text = `${title} ${item.content || ''}`.toLowerCase();
    if (adKeywords.some(k => text.includes(k))) continue;
    if (dictionaryKeywords.some(k => text.includes(k))) continue;

    let pass = false;
    if (titleDemandKeywords.some(k => title.includes(k))) pass = true;
    if (!pass && demandKeywords.some(k => text.includes(k))) pass = true;
    if (!pass && (item.platform === '知乎' || item.platform === '贴吧' || item.platform === '小红书') && title.length >= 8) pass = true;

    if (pass) results.push(item);
  }
  return results;
}

function localFilter(rawContents) {
  console.log('[AI] 使用本地规则进行过滤...');
  const painKeywords = ['麻烦', '太累', '不方便', '想要', '需要', '有没有', '求推荐', '求一个', '太难了', '痛苦', '浪费时间', '效率低', '复杂', '不会', '不懂', '怎么', '如何', '找不到', '没有'];
  const toolKeywords = ['工具', 'app', '软件', '网页', '小程序', '网站', '平台', '查询', '计算', '生成', '测试', '对比', '统计', '记录', '提醒', '搜索', '推荐', '分析', '转换', '翻译'];
  const adKeywords = ['加微信', 'qq群', '付费课程', '点击链接', '限时优惠'];

  const results = [];
  for (const item of rawContents) {
    const text = `${item.title} ${item.content}`.toLowerCase();
    if (adKeywords.some(k => text.includes(k))) continue;
    if (painKeywords.some(k => text.includes(k)) || toolKeywords.some(k => text.includes(k))) {
      results.push({
        painPoint: item.content.substring(0, 200) || item.title,
        toolIdea: generateToolIdea(item.title, item.content),
        reason: '本地规则匹配：包含需求关键词',
        sourceTitle: item.title,
        sourceContent: item.content,
        sourceUrl: item.url,
        sourcePlatform: item.platform,
      });
    }
  }
  console.log(`[AI] 本地过滤完成，识别出 ${results.length} 个潜在需求`);
  return results;
}

function generateToolIdea(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  if (text.includes('比价') || text.includes('价格') || text.includes('省钱')) return '做一个多平台一键比价查询 H5，输入商品名即可展示各平台价格对比';
  if (text.includes('记账') || text.includes('花钱') || text.includes('预算')) return '做一个极简记账 H5，每次花销只需点一下，自动生成月度消费报表';
  if (text.includes('喝水') || text.includes('健康') || text.includes('提醒')) return '做一个喝水/健康打卡 H5，定时推送提醒，一键记录，统计周报';
  if (text.includes('旅游') || text.includes('路线') || text.includes('旅行')) return '做一个旅游预算规划 H5，输入预算和天数，自动推荐路线和住宿方案';
  if (text.includes('菜谱') || text.includes('做饭') || text.includes('冰箱')) return '做一个"冰箱有啥做啥" H5，输入现有食材，AI 推荐可做的菜谱';
  if (text.includes('周报') || text.includes('日报') || text.includes('汇报')) return '做一个周报生成器 H5，输入关键词自动生成周报/日报模板';
  if (text.includes('简历') || text.includes('面试') || text.includes('求职')) return '做一个简历优化 H5，输入基本信息，AI 自动生成专业简历';
  if (text.includes('学习') || text.includes('考试') || text.includes('背单词')) return '做一个极简刷题/背单词 H5，每天 5 分钟碎片化学习';
  return '做一个针对该场景的微型查询/测算 H5 工具，解决用户的具体痛点';
}

module.exports = { analyzeWithDeepSeek, localFilter, parseAIResponse, normalizeAIInsights };
