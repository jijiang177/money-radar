# Google Sheet 数据落点配置

本文件用于把竞品价格雷达 MVP 的数据稳定写入 Google Sheet。

## 已创建的表格

表格名称：竞品价格雷达 MVP 数据收集

表格页签：

- `Events`：页面访问、CTA 点击、Demo 使用
- `Waitlist`：邮箱提交
- `Feedback`：用户反馈
- `Setup`：配置说明

## Apps Script 配置

1. 打开 Google Sheet。
2. 点击 `扩展程序` -> `Apps Script`。
3. 删除默认代码。
4. 复制 `docs/google-sheet-webhook.gs` 的内容进去。
5. 把第一行改成你的表格 ID：

```js
const SPREADSHEET_ID = 'PASTE_SPREADSHEET_ID_HERE';
```

表格 ID 是 Google Sheet 链接里 `/d/` 和 `/edit` 中间的那段。

6. 点击保存。
7. 点击 `部署` -> `新建部署`。
8. 类型选择 `Web 应用`。
9. 执行身份选择 `我`。
10. 访问权限选择 `任何人`。
11. 部署后复制生成的 Web App URL。

## 本地验证

拿到 Web App URL 后，在 MVP 目录运行：

```bash
npm run test:webhook -- --url=<your-google-apps-script-web-app-url>
```

成功后，Google Sheet 里应该出现 4 条测试数据：

- 1 条页面访问
- 1 条 CTA 点击
- 1 条邮箱提交
- 1 条用户反馈

## 配置到 Vercel

测试成功后，把 Web App URL 配置为 Vercel 的生产环境变量：

```text
DATA_WEBHOOK_URL=<your-google-apps-script-web-app-url>
```

配置后需要重新部署一次生产环境。部署完成后打开：

```text
https://competitor-price-radar-mvp.vercel.app/api/health
```

看到 `durableWebhookConfigured: true` 就说明稳定数据落点已接通。

## 安全提醒

- 不要把真实 Web App URL 写进 Git。
- 不要在表格里存 API Key、Token、密码、支付信息。
- 这个表格只用于 MVP 早期验证，不用于资金、交易或个人量化财富系统。
