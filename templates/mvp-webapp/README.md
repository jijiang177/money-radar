# MVP Web App 模板

这是一个可复用的验证型产品页面模板，用来把“产品机会”快速变成一个可上线测试的最小 MVP。

它故意保持很小：

- 不做登录系统
- 不做支付系统
- 不做复杂后台
- 不依赖外部前端框架
- 支持 Vercel 部署
- 包含落地页、等候名单、Demo、用户反馈和简单数据记录

## 目录结构

```text
mvp-webapp/
  api/
    events.js        # 记录访问、点击、Demo 使用
    feedback.js      # 记录用户反馈
    waitlist.js      # 记录邮箱提交
  public/
    app.js           # 页面渲染、Demo、事件上报
    config.js        # 每个新产品主要改这里
    index.html       # 落地页结构
    styles.css       # 通用页面样式
  scripts/
    dev-server.js    # 本地开发服务器
    generate-feedback-report.js # 生成产品表现周报
  data/              # 本地 JSONL 数据，运行后自动生成
  reports/           # 周报输出，运行后自动生成
```

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

本地提交会保存到：

```text
data/waitlist.jsonl
data/events.jsonl
data/feedback.jsonl
```

## 生成每周产品表现报告

```bash
npm run report:weekly
```

报告会输出到：

```text
reports/product-performance-weekly.md
reports/product-performance-weekly.json
```

报告会回答：

- 有没有人访问？
- 有没有人点击？
- 有没有人留下邮箱？
- 哪个产品机会值得继续？
- 是否值得继续消耗 Codex 额度？
- 是否应该放弃？
- 下一步最小迭代是什么？

## 部署到 Vercel

1. 把这个文件夹复制成一个新产品项目。
2. 推送到 GitHub。
3. 在 Vercel 导入这个仓库。
4. 直接部署。

页面和接口不需要额外依赖即可运行。

注意：Vercel Serverless 环境里的文件写入不适合作为长期数据库。正式验证时建议使用一个最简单的外部保存方式：

- 设置 `WAITLIST_WEBHOOK_URL` 到 Make、Zapier 或 Google Apps Script
- 设置 `FEEDBACK_WEBHOOK_URL` 保存用户反馈
- 设置 `EVENT_WEBHOOK_URL` 保存访问和点击事件
- 后续再接一个小数据库
- 早期烟雾测试可以先从 Vercel 函数日志导出

## 复制成下一个产品

1. 复制整个 `mvp-webapp` 文件夹。
2. 改名为你的产品 slug，例如：

```text
competitor-price-monitor-mvp
```

3. 修改 `public/config.js`：

- `productName`
- `headline`
- `pain`
- `solution`
- `targetUsers`
- `coreValues`
- `demo`
- `cta`

4. 本地运行，测试邮箱提交。
5. 部署到 Vercel。

## 已记录的数据

模板默认记录：

- `page_view`
- `cta_click`
- `demo_run`
- `waitlist_submit`
- `feedback_submit`

每条记录会尽量包含时间、产品 slug、页面路径、来源页面、浏览器信息等，方便判断是否有人真的感兴趣。

## 最小指标

周报会计算：

- 页面访问
- CTA 点击
- Demo 使用
- 邮箱提交
- 用户反馈数量
- 平均反馈评分
- CTA 点击率
- 邮箱转化率
- 反馈转化率
- 每日访问趋势

## PostHog 预留

模板暂时不强制接 PostHog，避免一开始引入复杂分析系统。

如果未来需要接入 PostHog，只要在页面中初始化 `window.posthog`，模板里的事件上报会自动调用：

```js
window.posthog.capture(eventName, event)
```

## 可选环境变量

```text
WAITLIST_WEBHOOK_URL=https://your-webhook.example.com
EVENT_WEBHOOK_URL=https://your-webhook.example.com
FEEDBACK_WEBHOOK_URL=https://your-webhook.example.com
PORT=3000
```

## 当前不包含的功能

- 用户登录
- 会员订阅
- 支付
- 复杂后台
- CRM
- 邮件营销自动化
- 默认生产数据库

这些功能只有在某个机会已经证明有真实需求后再加。
