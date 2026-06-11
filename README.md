# 💰 搞钱需求雷达 · 灵感定时推送

每天自动扫描互联网平台，用 AI 识别「可以被做成微型 H5 工具」的用户真实需求，生成灵感简报并邮件推送。

## ☁️ 云端运行（GitHub Actions）

项目通过 GitHub Actions 在云端自动运行，无需本地服务器。

### 定时规则
- **每天早上 9:00（北京时间）** 自动触发
- 支持手动触发（`workflow_dispatch`）

### 首次部署

```bash
# 1. 安装依赖
npm install

# 2. 配置 GitHub Secrets
#    在仓库 Settings → Secrets and variables → Actions 中添加：
#    - DEEPSEEK_API_KEY   （必填）
#    - MAIL_USER          （QQ邮箱地址）
#    - MAIL_PASS          （QQ邮箱SMTP授权码）
#    - MAIL_TO            （接收推送的邮箱）

# 3. 推送至 main 分支即可激活
```

## 功能

- 多源抓取：知乎 / 贴吧 / 小红书 / Hacker News / Product Hunt / Reddit / GitHub Trending / V2EX / 掘金 / 36kr / 百度热搜
- DeepSeek AI 痛点分析与过滤
- Markdown + HTML 邮件简报
- 趋势对比（近 7 天热度变化）

## 本地测试

```bash
node index.js              # 立即执行一次扫描
node index.js --skip-mail  # 跳过邮件发送
```
