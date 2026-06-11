/**
 * 灵感雷达 - 简报生成模块
 */

function generateReport(insights, trendSummary = '') {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const dayOfWeek = weekDays[now.getDay()];

  let report = `# 💡 灵感雷达 · 每日简报\n> 📅 ${dateStr} 星期${dayOfWeek} · 自动扫描全网用户需求\n\n---\n\n`;

  if (!insights || insights.length === 0) { report += `*今日未扫描到有效的工具需求，明天继续监控 🔍*\n\n---\n\n> 🤖 本简报由 AI 自动生成\n`; return report; }

  const platformGroups = {};
  for (const item of insights) { const platform = item.sourcePlatform || '其他'; if (!platformGroups[platform]) platformGroups[platform] = []; platformGroups[platform].push(item); }
  const platformCounts = Object.entries(platformGroups).sort((a, b) => b[1].length - a[1].length);

  const keywordHeat = new Map();
  for (const item of insights) { const text = (item.painPoint + ' ' + item.toolIdea).toLowerCase(); const words = text.match(/[\u4e00-\u9fa5]{2,6}/g) || []; const seen = new Set(words); for (const w of seen) keywordHeat.set(w, (keywordHeat.get(w) || 0) + 1); }
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

  const scored = insights.map(item => { const text = (item.painPoint + ' ' + item.toolIdea).toLowerCase(); let heatScore = 0; for (const [kw, count] of keywordHeat) { if (text.includes(kw)) heatScore += count; } return { item, heatScore }; });
  scored.sort((a, b) => b.heatScore - a.heatScore);

  if (trendSummary) { report += trendSummary + '---\n\n'; }
  report += `📊 **今日扫描**：共发现 **${insights.length}** 个潜在需求，来自 **${Object.keys(platformGroups).length}** 个平台\n\n`;
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
    report += `### 🎯 需求 #${num} ${complexity}${timeBadge}${multiPlatform}${categoryTag}${scoreTag}\n\n`;
    report += `🚨 **痛点**：${item.painPoint}\n\n`;
    report += `💡 **工具灵感**：${item.toolIdea}\n\n`;
    if (item.reason) { report += `📌 **分析理由**：${item.reason}\n\n`; }
    if (item.sourceUrl) { report += `🔗 **来源链接**：[查看原文](${item.sourceUrl})\n`; }
    if (item.sourcePlatform) { report += `🏷️ **来源平台**：\`${item.sourcePlatform}\`\n`; }
    report += `\n---\n\n`;
  });

  report += `> 🤖 本简报由 AI 自动生成\n> 📧 如有问题请联系：${process.env.MAIL_USER || ''}\n> ⏰ 每天早上 9:00 准时推送\n`;
  return report;
}

function generatePlainText(insights) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let text = `💡 灵感雷达 · 每日简报\n📅 ${dateStr}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  if (!insights || insights.length === 0) { text += '今日未扫描到有效的工具需求，明天继续监控 🔍\n\n'; return text; }
  insights.forEach((item, index) => { text += `【需求 #${index + 1}】\n🚨 痛点：${item.painPoint}\n💡 灵感：${item.toolIdea}\n`; if (item.sourceUrl) { text += `🔗 链接：${item.sourceUrl}\n`; } text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`; });
  text += '🤖 每天早上 9:00 准时推送\n';
  return text;
}

module.exports = { generateReport, generatePlainText };
