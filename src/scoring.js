const DIMENSION_DEFINITIONS = [
  ['demandStrength', '需求强度', '痛点是否明确、频率是否高、讨论热度是否强。'],
  ['internationalPotential', '国际化潜力', '是否能从中国需求扩展到海外，或本身来自国际信号源。'],
  ['willingnessToPay', '付费意愿', '用户是否靠近省钱、赚钱、业务效率、客户收入等付费场景。'],
  ['implementationDifficulty', '实现难度', '10 分代表最容易实现，1 分代表工程复杂度很高。'],
  ['competitionIntensity', '竞争强度', '10 分代表竞争压力可控，1 分代表红海且难切入。'],
  ['differentiationSpace', '差异化空间', '是否能做出清晰定位、细分场景或更轻量体验。'],
  ['repeatability', '复制性', '能否复用成模板、批量服务多个用户或扩展到多个垂直场景。'],
  ['indieDeveloperFit', '个人开发者适配度', '是否适合一个人用低成本、短周期做 MVP。'],
  ['dataVerifiability', '数据可验证性', '是否能通过点击、表单、邮件、日志或公开数据验证需求。'],
  ['monetizationClarity', '变现路径清晰度', '是否有明确的一次性付费、订阅、服务或线索变现路径。'],
];

function clampScore(value) {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function textOf(item) {
  return [
    item?.productOpportunity,
    item?.toolIdea,
    item?.painPoint,
    item?.targetUser,
    item?.existingSolutionGap,
    item?.mvpDirection,
    item?.sourceTitle,
    item?.sourceContent,
    item?.originalTitle,
    item?.sourcePlatform,
  ].filter(Boolean).join(' ').toLowerCase();
}

function includesAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

function yesLike(value) {
  return value === true || value === '是' || value === '高' || value === '中';
}

function scoreDemandStrength(item, text) {
  let score = 4;
  if (includesAny(text, ['太麻烦', '痛苦', '浪费时间', '效率低', '不方便', 'manual', 'painful', 'annoying', 'too heavy'])) score += 3;
  if (includesAny(text, ['有没有', '求推荐', 'looking for', 'need', 'what tools', 'alternative'])) score += 2;
  if (item.internationalDemandStrength === '高') score += 2;
  if (item.internationalDemandStrength === '中') score += 1;
  if (Number(item.internationalDemandScore || 0) >= 5) score += 1;
  if (Number(item.opportunityScore || 0) >= 6) score += 1;
  return clampScore(score);
}

function scoreInternationalPotential(item, text) {
  let score = 4;
  if (item.market === 'international' || item.radarSource === 'international') score += 4;
  if (yesLike(item.internationalPotential)) score += 2;
  if ((item.sourcePlatform || '').match(/Hacker News|Reddit|ProductHunt|GitHub|Indie/i)) score += 2;
  if (includesAny(text, ['saas', 'api', 'developer', 'spreadsheet', 'pricing', 'customer interview', 'product requirements'])) score += 1;
  if (includesAny(text, ['淘宝', '京东', '拼多多', '小红书', '微信'])) score -= 2;
  return clampScore(score);
}

function scoreWillingnessToPay(item, text) {
  let score = 4;
  if (item.willingnessToPay === '高') score += 4;
  else if (item.willingnessToPay === '中' || item.willingnessToPay === '是') score += 2;
  if (includesAny(text, ['省钱', '价格', '预算', '客户', '销售', '成交', '竞品', 'pricing', 'revenue', 'customer', 'saas', 'business'])) score += 3;
  if (includesAny(text, ['娱乐', '旅游', '菜谱', '打卡'])) score -= 1;
  return clampScore(score);
}

function scoreImplementationDifficulty(item, text) {
  let score = 7;
  if (includesAny(text, ['h5', '网页', '表单', '模板', '生成器', 'report generator', 'csv'])) score += 2;
  if (yesLike(item.codexMvpFit)) score += 1;
  if (includesAny(text, ['爬虫', '多平台', '实时', '支付', '用户系统', '数据库', 'websocket', 'browser extension'])) score -= 3;
  if (includesAny(text, ['api', 'oauth', 'app store', 'youtube', 'x/twitter'])) score -= 2;
  return clampScore(score);
}

function scoreCompetitionIntensity(text) {
  let score = 6;
  if (includesAny(text, ['记账', '比价', '周报', '简历', '剪贴板', 'clipboard'])) score -= 2;
  if (includesAny(text, ['现有方案可能偏贵', '学习成本高', '没有找到', 'too heavy', 'manual'])) score += 2;
  if (includesAny(text, ['垂直', '竞品价格', '用户访谈', 'product requirements', '细分'])) score += 2;
  if (includesAny(text, ['producthunt', 'github trending'])) score -= 1;
  return clampScore(score);
}

function scoreDifferentiationSpace(text) {
  let score = 5;
  if (includesAny(text, ['细分', '垂直', '轻量', 'too heavy', 'manual', '用户访谈', '竞品价格'])) score += 3;
  if (includesAny(text, ['ai', '自动', '生成', '分析', 'summary', 'requirements'])) score += 1;
  if (includesAny(text, ['微型查询/测算', '针对该场景'])) score -= 2;
  return clampScore(score);
}

function scoreRepeatability(text) {
  let score = 5;
  if (includesAny(text, ['模板', '生成', '报告', '监控', '自动', '批量', 'requirements', 'pricing', 'summary'])) score += 3;
  if (includesAny(text, ['多个垂直', '客户', 'saas', '团队'])) score += 1;
  if (includesAny(text, ['一次性', '旅游路线'])) score -= 1;
  return clampScore(score);
}

function scoreIndieDeveloperFit(item, text) {
  let score = yesLike(item.indieDeveloperFit) ? 7 : 4;
  if (yesLike(item.codexMvpFit)) score += 1;
  if (includesAny(text, ['h5', '表单', '模板', '单页', '英文落地页'])) score += 1;
  if (includesAny(text, ['企业级', '复杂系统', '大量数据', '支付', '多平台抓取'])) score -= 3;
  return clampScore(score);
}

function scoreDataVerifiability(item, text) {
  let score = 5;
  if (item.sourceUrl || item.link) score += 1;
  if (item.market === 'international' || item.sourcePlatform) score += 1;
  if (includesAny(text, ['落地页', '表单', '邮箱', 'waitlist', 'pricing', '竞品', '点击', '报名'])) score += 2;
  if (includesAny(text, ['公开数据', 'github', 'reddit', 'hacker news'])) score += 1;
  return clampScore(score);
}

function scoreMonetizationClarity(item, text) {
  let score = 4;
  if (item.willingnessToPay === '高' || item.willingnessToPay === '是') score += 2;
  if (includesAny(text, ['订阅', '一次性付费', '客户', '销售', '竞品', 'pricing', 'saas', 'business', 'revenue'])) score += 3;
  if (includesAny(text, ['消费者', '旅游', '菜谱', '打卡'])) score -= 1;
  return clampScore(score);
}

function getRecommendationLevel(totalScore) {
  if (totalScore >= 80) return 'A';
  if (totalScore >= 60) return 'B';
  return 'C';
}

function getRecommendationLabel(level) {
  if (level === 'A') return '值得立刻做 MVP';
  if (level === 'B') return '值得观察';
  return '暂不做';
}

function scoreOpportunity(item) {
  const text = textOf(item);
  const dimensions = {
    demandStrength: scoreDemandStrength(item, text),
    internationalPotential: scoreInternationalPotential(item, text),
    willingnessToPay: scoreWillingnessToPay(item, text),
    implementationDifficulty: scoreImplementationDifficulty(item, text),
    competitionIntensity: scoreCompetitionIntensity(text),
    differentiationSpace: scoreDifferentiationSpace(text),
    repeatability: scoreRepeatability(text),
    indieDeveloperFit: scoreIndieDeveloperFit(item, text),
    dataVerifiability: scoreDataVerifiability(item, text),
    monetizationClarity: scoreMonetizationClarity(item, text),
  };

  const totalScore = Object.values(dimensions).reduce((sum, value) => sum + value, 0);
  const recommendationLevel = getRecommendationLevel(totalScore);

  return {
    ...item,
    scoring: {
      dimensions,
      totalScore,
      recommendationLevel,
      recommendationLabel: getRecommendationLabel(recommendationLevel),
    },
  };
}

function scoreOpportunities(items) {
  return (items || [])
    .map(scoreOpportunity)
    .sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);
}

function getTopScoredOpportunities(items, limit = 3) {
  return scoreOpportunities(items).slice(0, limit);
}

function getCodexMvpRecommendation(items) {
  return scoreOpportunities(items)
    .filter(item => item.codexMvpFit === '是' || item.scoring.dimensions.implementationDifficulty >= 7)
    .sort((a, b) => {
      const aScore = b.scoring.totalScore - a.scoring.totalScore;
      if (aScore !== 0) return aScore;
      return b.scoring.dimensions.implementationDifficulty - a.scoring.dimensions.implementationDifficulty;
    })[0] || null;
}

function scoreSummaryRow(item, rank) {
  return {
    rank: rank + 1,
    title: item.productOpportunity || item.toolIdea || item.painPoint,
    totalScore: item.scoring.totalScore,
    level: item.scoring.recommendationLevel,
    recommendation: item.scoring.recommendationLabel,
    demandStrength: item.scoring.dimensions.demandStrength,
    internationalPotential: item.scoring.dimensions.internationalPotential,
    willingnessToPay: item.scoring.dimensions.willingnessToPay,
    implementationDifficulty: item.scoring.dimensions.implementationDifficulty,
    competitionIntensity: item.scoring.dimensions.competitionIntensity,
    differentiationSpace: item.scoring.dimensions.differentiationSpace,
    repeatability: item.scoring.dimensions.repeatability,
    indieDeveloperFit: item.scoring.dimensions.indieDeveloperFit,
    dataVerifiability: item.scoring.dimensions.dataVerifiability,
    monetizationClarity: item.scoring.dimensions.monetizationClarity,
    mvpDirection: item.mvpDirection,
    sourceUrl: item.sourceUrl || item.link || '',
  };
}

function buildScoreReport(items, dateStr) {
  const scored = scoreOpportunities(items);
  const top3 = scored.slice(0, 3);
  const codexPick = getCodexMvpRecommendation(scored);

  return {
    date: dateStr,
    dimensionDefinitions: DIMENSION_DEFINITIONS.map(([key, label, description]) => ({ key, label, description })),
    top3: top3.map(scoreSummaryRow),
    codexPick: codexPick ? scoreSummaryRow(codexPick, 0) : null,
    all: scored.map(scoreSummaryRow),
  };
}

function buildWeeklyTopReport(scoreReports, dateStr) {
  const seen = new Set();
  const merged = [];

  for (const report of scoreReports || []) {
    for (const item of report.all || []) {
      const key = String(item.title || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push({ ...item, sourceDate: report.date });
    }
  }

  merged.sort((a, b) => b.totalScore - a.totalScore);

  return {
    date: dateStr,
    top3: merged.slice(0, 3).map((item, index) => ({ ...item, rank: index + 1 })),
  };
}

function renderScoreMarkdown(scoreReport) {
  const lines = [
    `# 产品机会评分 - ${scoreReport.date}`,
    '',
    '## 今日 Top 3',
    '',
  ];

  for (const item of scoreReport.top3) {
    lines.push(`### ${item.rank}. ${item.title}`);
    lines.push(`- 总分：${item.totalScore}/100`);
    lines.push(`- 推荐等级：${item.level}（${item.recommendation}）`);
    lines.push(`- MVP：${item.mvpDirection || '待补充'}`);
    lines.push('');
  }

  if (scoreReport.codexPick) {
    lines.push('## 最值得动用 Codex 额度');
    lines.push('');
    lines.push(`- ${scoreReport.codexPick.title}`);
    lines.push(`- 总分：${scoreReport.codexPick.totalScore}/100`);
    lines.push(`- 原因：实现难度友好度 ${scoreReport.codexPick.implementationDifficulty}/10，个人开发者适配度 ${scoreReport.codexPick.indieDeveloperFit}/10`);
    lines.push('');
  }

  return lines.join('\n');
}

function renderWeeklyTopMarkdown(weeklyReport) {
  const lines = [
    `# 本周产品机会 Top 3 - ${weeklyReport.date}`,
    '',
  ];

  if (!weeklyReport.top3.length) {
    lines.push('暂无足够评分数据。');
    return lines.join('\n');
  }

  for (const item of weeklyReport.top3) {
    lines.push(`### ${item.rank}. ${item.title}`);
    lines.push(`- 总分：${item.totalScore}/100`);
    lines.push(`- 推荐等级：${item.level}（${item.recommendation}）`);
    lines.push(`- 来源日期：${item.sourceDate || weeklyReport.date}`);
    lines.push(`- MVP：${item.mvpDirection || '待补充'}`);
    lines.push('');
  }

  return lines.join('\n');
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function renderScoreCsv(scoreReport) {
  const headers = Object.keys(scoreReport.all[0] || {
    rank: '',
    title: '',
    totalScore: '',
    level: '',
    recommendation: '',
  });
  return [
    headers.join(','),
    ...scoreReport.all.map(row => headers.map(header => csvEscape(row[header])).join(',')),
  ].join('\n');
}

module.exports = {
  DIMENSION_DEFINITIONS,
  scoreOpportunity,
  scoreOpportunities,
  getTopScoredOpportunities,
  getCodexMvpRecommendation,
  buildScoreReport,
  buildWeeklyTopReport,
  renderScoreMarkdown,
  renderWeeklyTopMarkdown,
  renderScoreCsv,
};
