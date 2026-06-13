# 竞品价格雷达 MVP

这是从灵感雷达 Top 1 机会生成的第一个验证型 MVP 页面。

## 产品机会

- 目标用户：独立 SaaS 开发者、小团队产品负责人、准备出海的工具产品
- 核心痛点：手动查看竞品价格页、套餐页和更新日志很重复，容易漏掉变化
- MVP 形态：输入 2-5 个竞品 URL，生成价格/套餐/功能变化报告预览
- 当前目标：验证是否有人愿意留下邮箱、提交竞品列表或反馈真实工作流

## 如何运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

## 已记录的数据

- 页面访问：`page_view`
- CTA 点击：`cta_click`
- 演示使用：`demo_run`
- 邮箱提交：`waitlist_submit`
- 用户反馈：`feedback_submit`

本地数据保存到：

```text
data/events.jsonl
data/waitlist.jsonl
data/feedback.jsonl
```

## 生成每周反馈报告

```bash
npm run report:weekly
```

报告输出到：

```text
reports/product-performance-weekly.md
reports/product-performance-weekly.json
```

## 部署

优先部署到 Vercel。早期可以先使用 Vercel Functions 日志或 webhook 保存数据。

线上文件写入会使用 Vercel 临时目录，适合让表单正常响应，但不适合作为长期数据仓库。要稳定保存数据，优先配置一个统一 webhook。

后续可选环境变量：

```text
DATA_WEBHOOK_URL=
WAITLIST_WEBHOOK_URL=
EVENT_WEBHOOK_URL=
FEEDBACK_WEBHOOK_URL=
```

- `DATA_WEBHOOK_URL`：统一数据出口，页面访问、CTA、邮箱和反馈都会发送到这里。
- `WAITLIST_WEBHOOK_URL` / `EVENT_WEBHOOK_URL` / `FEEDBACK_WEBHOOK_URL`：可选细分出口，后续需要分流时再用。
- `/api/health`：检查当前数据保存模式，以及是否已经配置稳定 webhook。

## 暂不包含

- 登录系统
- 真实价格页爬取
- 自动定时监控
- 支付
- 复杂后台

这些等页面验证有真实需求后再加。
