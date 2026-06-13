# MVP 数据收集接入说明

目标：把线上 MVP 的访问、点击、邮箱和反馈稳定保存到一个外部数据落点。

## 最小推荐方案

先只配置一个统一入口：

```text
DATA_WEBHOOK_URL=
```

当前推荐落点是 Google Sheet。具体配置见：

```text
docs/google-sheet-webhook-setup.md
```

配置后，以下数据都会发送到这个地址：

- `page_view`：页面访问
- `cta_click`：按钮点击
- `demo_run`：演示使用
- `waitlist_submit`：邮箱提交
- `feedback_submit`：用户反馈

## 数据格式

每条记录都会尽量包含：

```json
{
  "schemaVersion": "mvp-event-v1",
  "type": "event",
  "productSlug": "competitor-price-radar-mvp",
  "createdAt": "2026-06-13T00:00:00.000Z",
  "receivedAt": "2026-06-13T00:00:01.000Z"
}
```

邮箱和反馈记录会额外包含 `email`、`rating`、`message` 等字段。

## 本地测试

拿到 webhook 地址后，不要写进 Git。可以临时运行：

```bash
npm run test:webhook -- --url=<your-webhook-url>
```

如果成功，会看到：

```text
Webhook test passed.
```

## 上线检查

部署后打开：

```text
https://competitor-price-radar-mvp.vercel.app/api/health
```

当 `durableWebhookConfigured` 为 `true` 时，说明 Vercel 环境里已经配置了稳定数据出口。

## 目前不做

- 不接支付
- 不做登录
- 不上复杂后台
- 不保存真实资金或交易数据
- 不把 webhook URL 写进代码仓库
