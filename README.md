# Inspiration Radar

An automated daily inspiration radar. It crawls public news and trend sources, asks AI to extract useful ideas, generates a Markdown/HTML brief, and sends one daily email.

## Official Schedule

The only formal scheduled sender is:

- `.github/workflows/inspiration-radar-daily.yml`
- Cron: `23 1 * * *`
- Time: UTC 01:23 = China 09:23 / Japan 10:23

Manual runs are supported through `workflow_dispatch`, but the default is `dry_run=true`, which generates a preview and does not send a real email.

## GitHub Secrets

Configure these in repository Settings -> Secrets and variables -> Actions:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL` optional, defaults to `deepseek-chat`
- `MAIL_HOST` optional, defaults to `smtp.qq.com`
- `MAIL_PORT` optional, defaults to `465`
- `MAIL_USER`
- `MAIL_PASS`
- `MAIL_TO`

Do not commit real secrets to the repository.

## Local Commands

```bash
npm install
npm test
npm run radar -- --dry-run
npm run radar
```

Use `npm run radar -- --dry-run` for local previews. A formal run records the successful send date in `data/radar_send_state.json` and blocks another formal send for the same date.
