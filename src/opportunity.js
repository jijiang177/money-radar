function textOf(item) {
  return `${item?.painPoint || ''} ${item?.toolIdea || ''} ${item?.sourceTitle || ''} ${item?.sourceContent || ''} ${item?.originalTitle || ''}`.toLowerCase();
}

function includesAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

function inferPainTheme(item) {
  const text = textOf(item);

  if (includesAny(text, ['competitor', 'pricing', '竞品', '价格监控'])) return '手动跟踪竞品价格变化';
  if (includesAny(text, ['customer interview', 'product requirements', '用户访谈', '需求文档'])) return '把用户访谈整理成产品需求';
  if (includesAny(text, ['spreadsheet', 'sheets', '表格', 'no-code', 'web applications'])) return '把表格数据发布成可用业务页面';
  if (includesAny(text, ['周报', '日报', '汇报'])) return '整理聊天和任务记录写周报';
  if (includesAny(text, ['比价', '价格', '省钱', '购物', '淘宝', '京东', '拼多多'])) return '跨平台比价和降价提醒';
  if (includesAny(text, ['旅行', '旅游', '路线', '住宿', '预算'])) return '规划旅行路线和预算';
  if (includesAny(text, ['简历', '面试', '求职', '岗位'])) return '按目标岗位优化简历';
  if (includesAny(text, ['内容', '小红书', '视频', '标题', '脚本', '发布'])) return '批量生成内容标题和发布文案';
  if (includesAny(text, ['客户', '销售', '成交', '私域', 'crm'])) return '跟进销售线索和客户话术';
  if (includesAny(text, ['lead list', 'leads', 'prospect', 'businesses you can sell to', 'sell to'])) return '寻找可销售客户名单';
  if (includesAny(text, ['喝水', '健康', '提醒'])) return '记录健康习惯并生成提醒';
  if (includesAny(text, ['学习', '考试', '背单词'])) return '碎片化刷题和背单词';
  if (includesAny(text, ['clipboard', 'bookmark', 'history', 'search'])) return '搜索个人剪贴板和收藏片段';

  return '';
}

function inferProductShape(item, mvpDirection = '') {
  const text = `${textOf(item)} ${mvpDirection}`.toLowerCase();

  if (includesAny(text, ['报告生成器', 'report generator', '对比表', '监控报告'])) return '报告生成器';
  if (includesAny(text, ['h5', '单页', '落地页', 'landing page'])) return 'H5 验证页';
  if (includesAny(text, ['表单', 'form', '输入', '上传', '粘贴'])) return '表单工具';
  if (includesAny(text, ['提醒', '记录', '打卡'])) return '记录提醒工具';
  if (includesAny(text, ['搜索', '查询'])) return '查询工具';
  if (includesAny(text, ['生成器', '自动生成'])) return '生成器';
  if (includesAny(text, ['lead list', 'leads', 'prospect'])) return '线索生成器';

  return '';
}

function isGenericOpportunityTitle(title = '') {
  return !title
    || includesAny(title, [
      '针对该场景',
      '微型查询/测算',
      '轻量表单输入',
      '该痛点',
      '围绕该',
      '具体痛点',
    ]);
}

function isGenericMvpDirection(mvpDirection = '') {
  return !mvpDirection
    || includesAny(mvpDirection, [
      '用户输入场景信息',
      '围绕该痛点',
      '围绕该海外需求信号',
      '轻量表单输入',
      '轻量 AI 表单工具',
      '有人愿意留下邮箱',
      '该机会',
      '可执行结果',
    ]);
}

function inferTargetUser(item) {
  const text = textOf(item);
  const platform = item?.sourcePlatform || '';

  if (includesAny(text, ['周报', '日报', '汇报', '会议', '邮件', 'spreadsheet', 'sheets'])) return '职场人、自由职业者、小团队负责人';
  if (includesAny(text, ['competitor', 'pricing', '竞品', '价格监控'])) return '独立开发者、SaaS 创始人、电商运营者';
  if (includesAny(text, ['customer interview', 'product requirements', '用户访谈', '需求文档'])) return '独立开发者、产品经理、早期 SaaS 团队';
  if (includesAny(text, ['简历', '面试', '求职', '岗位'])) return '求职者、应届生、转行人群';
  if (includesAny(text, ['比价', '价格', '省钱', '购物', '淘宝', '京东', '拼多多'])) return '价格敏感型消费者、家庭采购者';
  if (includesAny(text, ['旅行', '旅游', '路线', '住宿', '预算'])) return '自助旅行者、学生、年轻家庭';
  if (includesAny(text, ['喝水', '健康', '提醒'])) return '健康习惯养成用户、久坐办公人群';
  if (includesAny(text, ['学习', '考试', '背单词'])) return '学生、备考人群、语言学习者';
  if (includesAny(text, ['开发', '代码', 'github', 'api', '前端', '后端', '程序员'])) return '独立开发者、程序员、技术团队';
  if (includesAny(text, ['内容', '小红书', '视频', '标题', '脚本', '发布'])) return '内容创作者、自媒体、小商家';
  if (includesAny(text, ['客户', '销售', '成交', '私域', 'crm'])) return '销售、顾问、私域运营者';
  if (includesAny(text, ['lead list', 'leads', 'prospect', 'businesses you can sell to', 'sell to'])) return '独立开发者、SaaS 创始人、外贸销售';
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
  if (item.productOpportunity && !isGenericOpportunityTitle(item.productOpportunity)) return item.productOpportunity;
  if (item.toolIdea && item.category !== 'raw-signal' && !isGenericOpportunityTitle(item.toolIdea)) return item.toolIdea;

  if (includesAny(text, ['competitor', 'pricing', '竞品', '价格监控'])) return 'SaaS 创始人的竞品价格变化监控报告生成器';
  if (includesAny(text, ['customer interview', 'product requirements', '用户访谈', '需求文档'])) return '独立开发者的用户访谈转需求文档表单工具';
  if (includesAny(text, ['spreadsheet', 'sheets', '表格', 'no-code', 'web applications'])) return '运营团队的表格转业务展示页工具';
  if (includesAny(text, ['lead list', 'leads', 'prospect', 'businesses you can sell to', 'sell to'])) return '独立开发者的潜在客户线索列表生成器';

  if (includesAny(text, ['比价', '价格'])) return '价格敏感消费者的多平台比价和降价提醒 H5';
  if (includesAny(text, ['周报', '日报'])) return '职场人的聊天记录转周报 AI 生成器';
  if (includesAny(text, ['旅行', '旅游'])) return '自助旅行者的预算路线规划表单工具';
  if (includesAny(text, ['简历', '求职'])) return '求职者的岗位简历优化页面';
  if (includesAny(text, ['喝水', '健康', '提醒'])) return '健康习惯用户的喝水打卡提醒 H5';
  if (includesAny(text, ['学习', '考试', '背单词'])) return '学生的碎片化刷题背单词 H5';

  return '围绕该痛点做一个轻量表单输入、AI 生成结果的微型工具';
}

function inferMvpDirection(item) {
  const opportunity = inferProductOpportunity(item);
  const text = textOf(item);

  if (includesAny(text, ['比价', '价格'])) return '先做一个输入商品名、输出平台价格表和购买建议的 H5 页面';
  if (includesAny(text, ['周报', '日报', '汇报'])) return '先做一个粘贴聊天/工作记录、生成周报草稿的单页工具';
  if (includesAny(text, ['旅行', '旅游', '路线'])) return '先做一个输入预算、天数、城市，输出路线和预算拆分的表单工具';
  if (includesAny(text, ['competitor', 'pricing', '竞品', '价格监控'])) return '先做一个输入竞品 URL 列表、输出价格/功能对比表的报告生成器';
  if (includesAny(text, ['customer interview', 'product requirements', '用户访谈', '需求文档'])) return '先做一个粘贴访谈记录、输出痛点/需求/优先级的英文表单工具';
  if (includesAny(text, ['spreadsheet', 'sheets', '表格', 'no-code'])) return '先做一个上传 CSV/填写表格链接、生成只读展示页的单页工具';
  if (includesAny(text, ['简历', '面试', '求职'])) return '先做一个输入岗位和经历、输出简历改写建议的页面';
  if (includesAny(text, ['内容', '小红书', '抖音', '视频', '标题', '脚本', '文案', '发布'])) return '先做一个输入产品/主题、输出标题和发布文案的模板生成器';
  if (includesAny(text, ['lead list', 'leads', 'prospect', 'businesses you can sell to', 'sell to'])) return '先做一个输入目标行业和地区、输出潜在客户列表和外联理由的报告生成器';

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
  if (item?.market === 'international' || item?.radarSource === 'international') {
    score += 1;
    reasons.push(`国际需求强度：${item.internationalDemandStrength || '待验证'}`);
  }

  const boundedScore = Math.max(0, Math.min(10, score));
  return { score: boundedScore, reasons };
}

function yesNoLabel(value) {
  return value ? '是' : '否';
}

function buildSpecificOpportunityTitle(item, targetUser, mvpDirection) {
  const painTheme = inferPainTheme(item);
  const shape = inferProductShape(item, mvpDirection);
  const target = targetUser && !targetUser.includes('有明确场景痛点')
    ? targetUser.split('、')[0]
    : '';

  if (!target || !painTheme || !shape) return '';
  return `${target}的${painTheme}${shape}`;
}

function evaluateOpportunityQuality(item) {
  const title = item.productOpportunity || item.toolIdea || '';
  const targetUser = item.targetUser || '';
  const painTheme = inferPainTheme(item);
  const mvpShape = inferProductShape(item, item.mvpDirection || '');
  const genericTitle = isGenericOpportunityTitle(title);
  const genericMvp = isGenericMvpDirection(item.mvpDirection || '');
  const hasSpecificTarget = Boolean(targetUser && !targetUser.includes('有明确场景痛点'));
  const hasSpecificPain = Boolean(painTheme);
  const hasMvpShape = Boolean(mvpShape);
  const score = [hasSpecificTarget, hasSpecificPain, hasMvpShape, !genericTitle].filter(Boolean).length;
  const missing = [];

  if (!hasSpecificTarget) missing.push('缺少具体目标用户');
  if (!hasSpecificPain) missing.push('缺少具体痛点');
  if (!hasMvpShape) missing.push('缺少明确 MVP 形态');
  if (genericTitle) missing.push('标题过于泛化');
  if (genericMvp) missing.push('MVP 方向过于泛化');

  return {
    passed: score >= 4 && !genericMvp,
    score,
    hasSpecificTarget,
    hasSpecificPain,
    hasMvpShape,
    genericTitle,
    genericMvp,
    missing,
  };
}

function enrichProductOpportunity(item) {
  const scored = scoreOpportunity(item);
  const text = textOf(item);
  const targetUser = item.targetUser || inferTargetUser(item);
  const mvpDirection = item.mvpDirection && !isGenericMvpDirection(item.mvpDirection)
    ? item.mvpDirection
    : inferMvpDirection(item);
  const specificTitle = buildSpecificOpportunityTitle(item, targetUser, mvpDirection);
  const productOpportunity = specificTitle || inferProductOpportunity(item);
  const provisional = {
    ...item,
    productOpportunity,
    targetUser,
    mvpDirection,
  };
  const qualityGate = evaluateOpportunityQuality(provisional);
  const indieFit = qualityGate.passed && scored.score >= 4 && !includesAny(text, ['需要团队', '企业级', '复杂系统']);
  const codexFit = qualityGate.passed && (includesAny(text, ['生成', '总结', '分析', '对比', '查询', '计算', '模板', '表单', 'h5', '网页']) || scored.score >= 5);
  const international = includesAny(text, ['ai', 'api', 'spreadsheet', 'github', 'saas', 'clipboard', 'competitor', 'web app'])
    || (item?.sourcePlatform || '').match(/ProductHunt|HackerNews|Reddit|Indie Hackers|GitHub/i);
  const willingnessToPay = item?.willingnessToPay === '高'
    || item?.willingnessToPay === '中'
    || includesAny(text, ['省钱', '价格', '预算', '客户', '销售', '赚钱', '竞品', 'competitor', 'pricing', 'business'])
    || scored.score >= 6;

  let recommendation = '观察';
  if (scored.score >= 7 && indieFit && codexFit) recommendation = '建议做';
  if (scored.score <= 3 || !codexFit || !qualityGate.passed) recommendation = '暂不做';

  return {
    ...item,
    productOpportunity,
    targetUser,
    existingSolutionGap: item.existingSolutionGap || inferExistingSolutionGap(item),
    indieDeveloperFit: item.indieDeveloperFit || yesNoLabel(indieFit),
    codexMvpFit: item.codexMvpFit || yesNoLabel(codexFit),
    internationalPotential: item.internationalPotential || yesNoLabel(Boolean(international)),
    internationalDemandStrength: item.internationalDemandStrength || (international ? '中' : ''),
    willingnessToPay: item.willingnessToPay || yesNoLabel(Boolean(willingnessToPay)),
    recommendation: item.recommendation || recommendation,
    mvpDirection,
    opportunityScore: item.opportunityScore ?? (qualityGate.passed ? scored.score : Math.min(scored.score, 3)),
    opportunityReasons: item.opportunityReasons || [
      ...scored.reasons,
      ...(qualityGate.passed ? [] : [`质量门槛未通过：${qualityGate.missing.join('、')}`]),
    ],
    qualityGate,
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
  evaluateOpportunityQuality,
  isGenericOpportunityTitle,
  isGenericMvpDirection,
};
