function textOf(item) {
  return `${item?.painPoint || ''} ${item?.toolIdea || ''} ${item?.sourceTitle || ''} ${item?.sourceContent || ''}`.toLowerCase();
}

function includesAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

function inferTargetUser(item) {
  const text = textOf(item);
  const platform = item?.sourcePlatform || '';

  if (includesAny(text, ['周报', '日报', '汇报', '会议', '邮件', 'spreadsheet', 'sheets'])) return '职场人、自由职业者、小团队负责人';
  if (includesAny(text, ['competitor', 'pricing', '竞品', '价格监控'])) return '独立开发者、SaaS 创始人、电商运营者';
  if (includesAny(text, ['简历', '面试', '求职', '岗位'])) return '求职者、应届生、转行人群';
  if (includesAny(text, ['比价', '价格', '省钱', '购物', '淘宝', '京东', '拼多多'])) return '价格敏感型消费者、家庭采购者';
  if (includesAny(text, ['旅行', '旅游', '路线', '住宿', '预算'])) return '自助旅行者、学生、年轻家庭';
  if (includesAny(text, ['开发', '代码', 'github', 'api', '前端', '后端', '程序员'])) return '独立开发者、程序员、技术团队';
  if (includesAny(text, ['内容', '小红书', '视频', '标题', '脚本', '发布'])) return '内容创作者、自媒体、小商家';
  if (includesAny(text, ['客户', '销售', '成交', '私域', 'crm'])) return '销售、顾问、私域运营者';
  if (platform.includes('ProductHunt') || platform.includes('HackerNews') || platform.includes('Reddit')) return '海外独立开发者、SaaS 用户、效率工具用户';

  return '有明确场景痛点的个人用户或小团队';
}

function inferExistingSolutionGap(item) {
  const text = textOf(item);
  const gaps = [];

  if (includesAny(text, ['太麻烦', '复杂', '来回切换', '多个app', '多个平台', '手动'])) gaps.push('现有流程分散，需要在多个工具之间切换');
  if (includesAny(text, ['贵', '价格', '订阅', '付费', '昂贵'])) gaps.push('现有方案可能偏贵或不适合轻量用户');
  if (includesAny(text, ['不会', '不懂', '太难', '门槛'])) gaps.push('现有方案学习成本高');
  if (includesAny(text, ['找不到', '没有', '有没有', '求推荐'])) gaps.push('用户没有找到足够顺手的轻量替代品');
  if (includesAny(text, ['ai', '自动', '生成', '分析'])) gaps.push('现有方案自动化程度可能不足');

  return gaps.length > 0 ? gaps.join('；') : '暂未发现明显供给缺口，需要继续验证竞品复杂度和价格';
}

function inferProductOpportunity(item) {
  const text = textOf(item);
  if (includesAny(text, ['competitor', 'pricing', '竞品', '价格监控'])) return '竞品价格和功能自动监控报告工具';
  if (includesAny(text, ['spreadsheet', 'sheets', '表格', 'no-code', 'web applications'])) return '把表格快速发布成业务小应用的轻量工具';
  if (item.productOpportunity) return item.productOpportunity;
  if (item.toolIdea && item.category !== 'raw-signal') return item.toolIdea;

  if (includesAny(text, ['比价', '价格'])) return '多平台价格对比和降价提醒工具';
  if (includesAny(text, ['周报', '日报'])) return '聊天记录/任务记录转周报的 AI 生成器';
  if (includesAny(text, ['旅行', '旅游'])) return '预算驱动的旅行路线规划工具';
  if (includesAny(text, ['简历', '求职'])) return '面向具体岗位的简历优化工具';

  return '围绕该痛点做一个轻量表单输入、AI 生成结果的微型工具';
}

function inferMvpDirection(item) {
  const opportunity = inferProductOpportunity(item);
  const text = textOf(item);

  if (includesAny(text, ['比价', '价格'])) return '先做一个输入商品名、输出平台价格表和购买建议的 H5 页面';
  if (includesAny(text, ['周报', '日报', '汇报'])) return '先做一个粘贴聊天/工作记录、生成周报草稿的单页工具';
  if (includesAny(text, ['旅行', '旅游', '路线'])) return '先做一个输入预算、天数、城市，输出路线和预算拆分的表单工具';
  if (includesAny(text, ['competitor', 'pricing', '竞品', '价格监控'])) return '先做一个输入竞品 URL 列表、输出价格/功能对比表的报告生成器';
  if (includesAny(text, ['spreadsheet', 'sheets', '表格', 'no-code'])) return '先做一个上传 CSV/填写表格链接、生成只读展示页的单页工具';
  if (includesAny(text, ['简历', '面试', '求职'])) return '先做一个输入岗位和经历、输出简历改写建议的页面';
  if (includesAny(text, ['内容', '标题', '脚本'])) return '先做一个输入产品/主题、输出标题和发布文案的模板生成器';

  return `先做一个表单版 MVP：用户输入场景信息，系统输出“${opportunity}”的可执行结果`;
}

function scoreOpportunity(item) {
  const text = textOf(item);
  let score = Number(item?.score || 0);
  const reasons = [];

  if (includesAny(text, ['太麻烦', '痛苦', '浪费时间', '效率低', '不方便', '来回切换'])) {
    score += 2;
    reasons.push('痛点强');
  }
  if (includesAny(text, ['付费', '价格', '省钱', '赚钱', '客户', '销售', '预算', '订阅'])) {
    score += 2;
    reasons.push('靠近付费或收入场景');
  }
  if (includesAny(text, ['生成', '分析', '总结', '推荐', '对比', '查询', '计算', '转换'])) {
    score += 1;
    reasons.push('适合用 AI 或规则快速交付结果');
  }
  if (includesAny(text, ['h5', '网页', '小程序', '表单', '模板'])) {
    score += 1;
    reasons.push('MVP 形态轻');
  }
  if (includesAny(text, ['后端', '数据库', '支付', '用户系统', '实时', '爬虫', '多平台'])) {
    score -= 1;
    reasons.push('实现复杂度偏高');
  }
  if ((item?.sourcePlatform || '').match(/ProductHunt|HackerNews|Reddit|Indie Hackers|GitHub/i)) {
    score += 1;
    reasons.push('有国际化信号');
  }

  const boundedScore = Math.max(0, Math.min(10, score));
  return { score: boundedScore, reasons };
}

function yesNoLabel(value) {
  return value ? '是' : '否';
}

function enrichProductOpportunity(item) {
  const scored = scoreOpportunity(item);
  const text = textOf(item);
  const indieFit = scored.score >= 4 && !includesAny(text, ['需要团队', '企业级', '复杂系统']);
  const codexFit = includesAny(text, ['生成', '总结', '分析', '对比', '查询', '计算', '模板', '表单', 'h5', '网页']) || scored.score >= 5;
  const international = includesAny(text, ['ai', 'api', 'spreadsheet', 'github', 'saas', 'clipboard', 'competitor', 'web app'])
    || (item?.sourcePlatform || '').match(/ProductHunt|HackerNews|Reddit|Indie Hackers|GitHub/i);
  const willingnessToPay = includesAny(text, ['省钱', '价格', '预算', '客户', '销售', '赚钱', '竞品', 'competitor', 'pricing', 'business'])
    || scored.score >= 6;

  let recommendation = '观察';
  if (scored.score >= 7 && indieFit && codexFit) recommendation = '建议做';
  if (scored.score <= 3 || !codexFit) recommendation = '暂不做';

  return {
    ...item,
    productOpportunity: inferProductOpportunity(item),
    targetUser: item.targetUser || inferTargetUser(item),
    existingSolutionGap: item.existingSolutionGap || inferExistingSolutionGap(item),
    indieDeveloperFit: item.indieDeveloperFit || yesNoLabel(indieFit),
    codexMvpFit: item.codexMvpFit || yesNoLabel(codexFit),
    internationalPotential: item.internationalPotential || yesNoLabel(Boolean(international)),
    willingnessToPay: item.willingnessToPay || yesNoLabel(Boolean(willingnessToPay)),
    recommendation: item.recommendation || recommendation,
    mvpDirection: item.mvpDirection || inferMvpDirection(item),
    opportunityScore: item.opportunityScore ?? scored.score,
    opportunityReasons: item.opportunityReasons || scored.reasons,
  };
}

function enrichProductOpportunities(insights) {
  return (insights || []).map(enrichProductOpportunity);
}

function getTopOpportunities(insights, limit = 5) {
  return enrichProductOpportunities(insights)
    .sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0))
    .slice(0, limit);
}

module.exports = {
  enrichProductOpportunity,
  enrichProductOpportunities,
  getTopOpportunities,
};
