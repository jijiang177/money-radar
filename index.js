#!/usr/bin/env node

/**
 * 💡 灵感雷达 - 主入口
 * 
 * 完整流程：
 * 1. 爬虫抓取 → 2. AI 分析 → 3. 生成简报 → 4. 邮件推送
 * 
 * 使用方式（本地测试）：
 *   node index.js              # 立即执行一次
 *   node index.js --skip-mail  # 跳过邮件发送
 * 
 * 生产环境通过 GitHub Actions 每天 9:00 自动运行
 * 配置文件 → .github/workflows/radar.yml
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { crawlAll } = require('./src/crawler');
const { analyzeWithDeepSeek } = require('./src/ai');
const { generateReport, generatePlainText } = require('./src/reporter');
const { sendDailyReport } = require('./src/mailer');

/**
 * 运行一次完整的雷达扫描流程
 */
async function runRadar(options = {}) {
  const startTime = Date.now();

  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║     💡 灵感雷达 · 启动扫描            ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  try {
    console.log('📡 [1/4] 扫描各平台用户需求...');
    const rawContents = await crawlAll({
      zhihuKeyword: options.zhihuKeyword,
      tiebaKeyword: options.tiebaKeyword,
    });
    console.log(`       ✅ 获取 ${rawContents.length} 条原始内容\n`);

    console.log('🧠 [2/4] AI 痛点提炼与过滤...');
    const insights = await analyzeWithDeepSeek(rawContents);
    console.log(`       ✅ 识别出 ${insights.length} 个有效需求\n`);

    console.log('📝 [3/4] 生成灵感简报...');

    const historyFile = path.join(__dirname, 'data', 'radar_history.json');
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const todayKeywords = extractKeywords(insights);

    let history = [];
    if (fs.existsSync(historyFile)) {
      try { history = JSON.parse(fs.readFileSync(historyFile, 'utf-8')); } catch {}
    }

    const recentDays = history.slice(-7);
    const trendSummary = buildTrendSummary(todayKeywords, recentDays, dateStr);

    history.push({
      date: dateStr,
      insightCount: insights.length,
      topKeywords: todayKeywords.slice(0, 10),
      platformDistribution: getPlatformDist(insights),
    });
    if (history.length > 90) history = history.slice(-90);
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf-8');
    console.log(`       ✅ 趋势数据已保存 (${history.length} 天历史)`);

    const markdownReport = generateReport(insights, trendSummary);
    const plainText = generatePlainText(insights);

    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    const reportFile = path.join(reportDir, `简报-${dateStr}.md`);
    fs.writeFileSync(reportFile, markdownReport, 'utf-8');
    console.log(`       ✅ 简报已保存: ${reportFile}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 简报预览:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(markdownReport.substring(0, 800));
    if (markdownReport.length > 800) {
      console.log('... (完整内容已保存到文件)');
    }
    console.log('');

    if (!options.skipMail) {
      console.log('📧 [4/4] 推送邮件...');
      const sent = await sendDailyReport(markdownReport, plainText, insights);
      if (sent) {
        console.log('       ✅ 邮件推送成功\n');
      } else {
        console.log('       ⚠️ 邮件推送失败（请检查邮箱配置）\n');
      }
    } else {
      console.log('📧 [4/4] 跳过邮件推送（--skip-mail 模式）\n');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('╔══════════════════════════════════════╗');
    console.log('║     ✅ 灵感雷达 · 扫描完成           ║');
    console.log(`║     耗时: ${elapsed}s                    ║`);
    console.log(`║     需求: ${insights.length} 个                   ║`);
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    return { rawContents, insights, markdownReport };
  } catch (err) {
    console.error(`\n❌ 灵感雷达异常: ${err.message}`);
    console.error(err.stack);
    throw err;
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    skipMail: args.includes('--skip-mail'),
    skipCrawl: args.includes('--skip-crawl'),
  };

  const zhihuIdx = args.indexOf('--zhihu-keyword');
  if (zhihuIdx > -1 && args[zhihuIdx + 1]) {
    options.zhihuKeyword = args[zhihuIdx + 1];
  }
  const tiebaIdx = args.indexOf('--tieba-keyword');
  if (tiebaIdx > -1 && args[tiebaIdx + 1]) {
    options.tiebaKeyword = args[tiebaIdx + 1];
  }

  runRadar(options).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

function extractKeywords(insights) {
  const freq = new Map();
  for (const item of insights) {
    const text = (item.painPoint + ' ' + item.toolIdea).toLowerCase();
    const words = text.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
    const seen = new Set(words);
    for (const w of seen) freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([kw, count]) => ({ keyword: kw, count }));
}

function getPlatformDist(insights) {
  const dist = {};
  for (const item of insights) {
    const p = item.sourcePlatform || '其他';
    dist[p] = (dist[p] || 0) + 1;
  }
  return dist;
}

function buildTrendSummary(todayKeywords, recentDays, todayStr) {
  if (recentDays.length === 0) return '';

  const histFreq = new Map();
  for (const day of recentDays) {
    for (const kw of (day.topKeywords || [])) {
      histFreq.set(kw.keyword, (histFreq.get(kw.keyword) || 0) + kw.count);
    }
  }

  const surges = [];
  for (const kw of todayKeywords) {
    const histCount = histFreq.get(kw.keyword) || 0;
    const avgDaily = histCount / Math.max(recentDays.length, 1);
    if (kw.count > avgDaily * 2 && kw.count >= 3) {
      surges.push(kw.keyword);
    }
  }

  const histKeys = new Set(histFreq.keys());
  const newKws = todayKeywords.filter(kw => !histKeys.has(kw.keyword)).slice(0, 5).map(k => k.keyword);

  let summary = '';
  if (surges.length > 0) summary += `📈 **热度飙升**：${surges.map(k => `\`${k}\``).join(' ')}\n\n`;
  if (newKws.length > 0) summary += `🆕 **新涌现**：${newKws.map(k => `\`${k}\``).join(' ')}\n\n`;
  if (!summary) summary = `_*趋势平稳，无显著变化（对比最近 ${recentDays.length} 天）_*\n\n`;

  return `## 📈 趋势对比（最近 ${recentDays.length} 天 vs 今日）\n\n${summary}`;
}

module.exports = { runRadar };
