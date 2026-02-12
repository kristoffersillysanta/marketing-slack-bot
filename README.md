# Marketing Slack Bot

Automated marketing performance reporting bot for [SillySanta AS](https://sillysanta.com). Sends daily, weekly, and monthly reports to Slack with ROAS, AOV, new customer rates, and channel performance across all markets.

## How it works

```
Cloudflare Worker (cron) → Google Sheets → Slack Webhook
```

A Cloudflare Worker runs on a cron schedule, fetches marketing data from Google Sheets (synced from Triple Whale), formats performance reports, and posts them to a Slack channel.

## Reports

All times shown in Norwegian time (CET winter / CEST summer).

| Report | Schedule | Content | Purpose |
|--------|----------|---------|---------|
| Daily | Tue–Fri 08:00 / 09:00 | Yesterday's performance | "Are we spending what we should?" |
| Weekly | Monday 08:00 / 09:00 | Previous week (Mon–Sun) | "Is something wrong?" |
| Monthly | 1st of month 09:00 / 10:00 | Previous month | "What should we adjust?" |

### What's in each report

**Daily:**
- Main table: Store, Revenue, Spend, MER, NC%, Orders, AOV, vs LY
- Channel breakdown: Inline with Channel ROAS
- Info footer

**Weekly:**
- Main table (same as daily)
- 3-week trend
- Channel tables per country: Pixel ROAS, Channel ROAS, NC ROAS
- Pixel data warning (if recent)
- No-spend warning

**Monthly:**
- Main table (same as weekly)
- 3-month trend
- Channel tables per country: Pixel ROAS, Channel ROAS, NC ROAS, NC Orders
- No-spend warning

### Metrics explained

- **Revenue** — Gross order revenue (ex-VAT), before refunds
- **Spend** — Total ad spend across all channels (Meta, Google, TikTok)
- **MER** — Marketing efficiency ratio: revenue / spend (before refunds)
- **NC%** — New customer percentage: new_customer_orders / total_orders × 100
- **AOV** — Average order value: revenue / orders
- **Pixel ROAS** — Return on ad spend using pixel-tracked revenue per channel
- **Channel ROAS** — Return on ad spend using platform-reported revenue
- **NC ROAS** — New customer ROAS: pixel-tracked new customer revenue / spend

## Setup

### Prerequisites

- [Cloudflare Workers](https://workers.cloudflare.com/) account
- Google Sheets with Triple Whale marketing data sync
- Slack incoming webhook URL for marketing channel

### Deploy

```bash
cd worker && npx wrangler deploy
```

### Set secrets

```bash
npx wrangler secret put SLACK_WEBHOOK_URL_MARKETING
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT
```

### Preview reports

```bash
curl https://marketing-slack-bot.seoblogbot.workers.dev/preview-daily
curl https://marketing-slack-bot.seoblogbot.workers.dev/preview-weekly
curl https://marketing-slack-bot.seoblogbot.workers.dev/preview-monthly
```

## Project structure

| File | Description |
|------|-------------|
| `worker/src/index.ts` | Main logic, cron handling |
| `worker/src/report.ts` | Report generation (daily/weekly/monthly) |
| `worker/src/formatting.ts` | Table formatting utilities |
| `worker/src/metrics.ts` | ROAS, NC%, AOV calculations |
| `worker/src/data.ts` | Data loading and filtering |
| `worker/src/sheets.ts` | Google Sheets integration |
| `worker/src/types.ts` | TypeScript interfaces |
| `worker/src/shops.ts` | Shop configuration |
| `worker/src/triplewhale.ts` | Date utilities |
| `worker/src/slack.ts` | Slack webhook sending |
| `worker/wrangler.toml` | Cloudflare Worker config, cron schedules |

## Markets

All 8 markets: NO, SE, DK, FI, DE, NL, UK, COM.

Data sourced from a single Google Sheet with one tab per country, synced daily from Triple Whale.

**Note:** Countries and channels without spend are automatically hidden from reports.
