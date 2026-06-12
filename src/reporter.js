/**
 * 灵感雷达 - 产品机会报告生成模块
 */

const { enrichProductOpportunities, getTopOpportunities } = require('./opportunity');
const { buildScoreReport } = require('./scoring');

function generateReport(insights, trendSummary = '') {
  const enrichedInsights = enrichProductOpportunities(insights || []);
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const dayOfWeek = weekDays[now.getDay()];

  let report = `# 产品机会雷达 · 每日报告\n> ${dateStr} 星期${dayOfWeek} · 从公开信息中提取可变现产品机会\n\n---\n\n`;

  if (enrichedInsights.length === 0) { report += `*今日未扫描到有效的产品机会，明天继续监控。*\n\n---\n\n> 本报告由 AI 自动生成\n`; return report; }

  const platformGroups = {};
  for (const item of enrichedInsights) { const platform = item.sourcePlatform || '其他'; if (!platformGroups[platform]) platformGroups[platform] = []; platformGroups[platform].push(item); }
  const platformCounts = Object.entries(platformGroups).sort((a, b) => b[1].length - a[1].length);

  const keywordHeat = new Map();
  for (const item of enrichedInsights) { const text = (item.painPoint + ' ' + item.toolIdea + ' ' + item.productOpportunity).toLowerCase(); const words = text.match(/[\u4e00-\u9fa5]{2,6}/g) || []; const seen = new Set(words); for (const w of seen) keywordHeat.set(w, (keywordHeat.get(w) || 0) + 1); }
  const hotKeywords = [...keywordHeat.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8);

  function estimateComplexity(idea) {
    const text = (idea || '').toLowerCase();
    let score = 1;
    if (/(后端|数据库|server|api|login|auth|支付|订单|用户系统)/.test(text)) score += 2;
    if (/(ai|gpt|llm|模型|训练|nlp|识别|推荐)/.test(text)) score += 1;
    if (/(实时|websocket|推送|通知|监控|cron|定时)/.test(text)) score += 1;
    if (/(爬虫|抓取|数据源|多平台|聚合)/.test(text)) score += 1;
    if (/(h5|网页|前端|静态|生成|计算|转换|翻译|查询|对比|统计)/.test(text)) score = Math.min(score, 2);
    if (score <= 2) return '⭐ 1天可做';
    if (score <= 3) return '⭐⭐ 周末项目';
    return '⭐⭐⭐ 需要团队';
  }

  function getUrgency(item) {
    try {
      const created = new Date(item.sourceCreatedAt || item.createdAt || Date.now());
      const hours = (Date.now() - created.getTime()) / 3600000;
      if (hours < 4) return { label: '🔥 刚刚', hours };
      if (hours < 12) return { label: '🕐 今天', hours };
      if (hours < 48) return { label: '📅 1-2天前', hours };
      return { label: '📆 数天前', hours };
    } catch { return { label: '', hours: 999 }; }
  }

  const scored = enrichedInsights.map(item => {
    const text = (item.painPoint + ' ' + item.toolIdea + ' ' + item.productOpportunity).toLowerCase();
    let heatScore = item.opportunityScore || 0;
    for (const [kw, count] of keywordHeat) { if (text.includes(kw)) heatScore += count; }
    return { item, heatScore };
  });
  scored.sort((a, b) => b.heatScore - a.heatScore);
  const scoreReport = buildScoreReport(enrichedInsights, dateStr);

  if (trendSummary) { report += trendSummary + '---\n\n'; }
  report += `## 今日评分 Top 3\n\n`;
  scoreReport.top3.forEach(item => {
    report += `### ${item.rank}. ${item.title}\n\n`;
    report += `- **总分**：${item.totalScore}/100\n`;
    report += `- **推荐等级**：${item.level}（${item.recommendation}）\n`;
    report += `- **MVP 方向**：${item.mvpDirection || '待补充'}\n\n`;
  });

  if (scoreReport.codexPick) {
    report += `## 最值得动用 Codex 额度的 1 个\n\n`;
    report += `**${scoreReport.codexPick.title}**\n\n`;
    report += `- 总分：${scoreReport.codexPick.totalScore}/100\n`;
    report += `- 推荐等级：${scoreReport.codexPick.level}（${scoreReport.codexPick.recommendation}）\n`;
    report += `- 原因：实现难度友好度 ${scoreReport.codexPick.implementationDifficulty}/10，个人开发者适配度 ${scoreReport.codexPick.indieDeveloperFit}/10\n`;
    report += `- MVP 方向：${scoreReport.codexPick.mvpDirection || '待补充'}\n\n`;
  }

  report += `---\n\n`;
  report += `## 今日 Top 5 产品机会\n\n`;
  const topOpportunities = getTopOpportunities(enrichedInsights, 5);
  topOpportunities.forEach((item, index) => {
    const reasons = (item.opportunityReasons || []).join('、') || item.reason || '来源信息显示存在明确需求';
    report += `### ${index + 1}. ${item.productOpportunity}\n\n`;
    report += `- **建议**：${item.recommendation}（机会分：${item.opportunityScore}/10）\n`;
    report += `- **用户痛点**：${item.painPoint}\n`;
    report += `- **目标用户**：${item.targetUser}\n`;
    report += `- **为什么是机会**：${reasons}\n`;
    report += `- **现有方案缺口**：${item.existingSolutionGap}\n`;
    report += `- **最小 MVP**：${item.mvpDirection}\n`;
    if (item.market === 'international' || item.internationalDemandStrength) {
      report += `- **国际需求强度**：${item.internationalDemandStrength || '待验证'}\n`;
    }
    report += `- **个人开发者适合**：${item.indieDeveloperFit}；**Codex 快速 MVP**：${item.codexMvpFit}；**国际化**：${item.internationalPotential}；**付费可能**：${item.willingnessToPay}\n\n`;
  });

  report += `---\n\n`;
  report += `## 全量机会池\n\n`;
  report += `📊 **今日扫描**：共发现 **${enrichedInsights.length}** 个潜在需求/机会，来自 **${Object.keys(platformGroups).length}** 个平台\n\n`;
  report += `### 来源分布\n` + platformCounts.map(([p, items]) => `- **${p}**：${items.length} 条`).join('\n') + `\n\n`;
  if (hotKeywords.length > 0) { report += `### 🔥 今日热词\n` + hotKeywords.map(([kw, c]) => `\`${kw}(${c})\``).join(' ') + `\n\n`; }
  report += `---\n\n`;

  scored.forEach(({ item }, index) => {
    const num = index + 1;
    const complexity = estimateComplexity(item.toolIdea || '');
    const urgency = getUrgency(item);
    const timeBadge = urgency.label ? ` ${urgency.label}` : '';
    const categoryTag = item.category ? ` \`#${item.category}\`` : '';
    const scoreTag = item.score ? ` 📊${item.score}分` : '';
    const multiPlatform = (item.sourcePlatform || '').includes('/') ? ' 🌐 多平台' : '';
    report += `### 机会 #${num} ${complexity}${timeBadge}${multiPlatform}${categoryTag}${scoreTag}\n\n`;
    report += `🚨 **痛点**：${item.painPoint}\n\n`;
    report += `💡 **产品机会**：${item.productOpportunity}\n\n`;
    report += `👤 **目标用户**：${item.targetUser}\n\n`;
    report += `🧩 **现有方案缺口**：${item.existingSolutionGap}\n\n`;
    report += `🛠 **最小 MVP**：${item.mvpDirection}\n\n`;
    report += `✅ **建议**：${item.recommendation}（机会分：${item.opportunityScore}/10）\n\n`;
    if (item.market === 'international' || item.internationalDemandStrength) {
      report += `🌍 **国际需求强度**：${item.internationalDemandStrength || '待验证'}\n\n`;
    }
    report += `📌 **判断**：个人开发者适合=${item.indieDeveloperFit}；Codex MVP=${item.codexMvpFit}；国际化=${item.internationalPotential}；付费可能=${item.willingnessToPay}\n\n`;
    if (item.reason) { report += `📌 **分析理由**：${item.reason}\n\n`; }
    if (item.sourceUrl) { report += `🔗 **来源链接**：[查看原文](${item.sourceUrl})\n`; }
    if (item.sourcePlatform) { report += `🏷️ **来源平台**：\`${item.sourcePlatform}\`\n`; }
    report += `\n---\n\n`;
  });

  report += `> 本报告由 AI 自动生成，用于发现产品机会，不构成投资或经营承诺。\n> 如有问题请联系：${process.env.MAIL_USER || ''}\n> 每天早上 9:00 准时推送\n`;
  return report;
}

function generatePlainText(insights) {
  const enrichedInsights = enrichProductOpportunities(insights || []);
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let text = `产品机会雷达 · 每日报告\n日期：${dateStr}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  if (enrichedInsights.length === 0) { text += '今日未扫描到有效的产品机会，明天继续监控。\n\n'; return text; }
  text += '今日 Top 5 产品机会\n\n';
  const scoreReport = buildScoreReport(enrichedInsights, dateStr);
  text += '今日评分 Top 3\n';
  scoreReport.top3.forEach(item => {
    text += `${item.rank}. ${item.title} - ${item.totalScore}/100，${item.level}（${item.recommendation}）\n`;
  });
  if (scoreReport.codexPick) {
    text += `最值得动用 Codex：${scoreReport.codexPick.title}\n`;
  }
  text += '\n';

  getTopOpportunities(enrichedInsights, 5).forEach((item, index) => {
    text += `【机会 #${index + 1}】${item.productOpportunity}\n`;
    text += `建议：${item.recommendation}（机会分：${item.opportunityScore}/10）\n`;
    text += `痛点：${item.painPoint}\n`;
    text += `目标用户：${item.targetUser}\n`;
    text += `MVP：${item.mvpDirection}\n`;
    if (item.market === 'international' || item.internationalDemandStrength) {
      text += `国际需求强度：${item.internationalDemandStrength || '待验证'}\n`;
    }
    if (item.sourceUrl) { text += `链接：${item.sourceUrl}\n`; }
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  });
  text += '每天早上 9:00 准时推送\n';
  return text;
}

module.exports = { generateReport, generatePlainText };
