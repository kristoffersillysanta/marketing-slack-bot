# Marketing Slack Bot

Slack-bot som sender automatiske marketing performance-rapporter for SillySanta AS.

## Arkitektur

```
Cloudflare Worker (cron) → Google Sheets → Slack Webhook
```

## Rapporter

Alle tider er norsk tid (CET vinter / CEST sommer). Cron bruker UTC internt.

| Cron (UTC) | Norsk tid | Rapport |
|---|---|---|
| `0 7 * * TUE-FRI` | 08:00 / 09:00 | Daily (gårsdagens tall) |
| `0 7 * * MON` | 08:00 / 09:00 | Weekly (forrige uke ma-sø) |
| `0 8 1 * *` | 09:00 / 10:00 | Monthly (forrige måned) |

**Formål:**
- **Daily**: "Bruker vi det vi skal?"
- **Weekly**: "Er noe galt?"
- **Monthly**: "Hva skal vi justere?"

## Data-kilde (Google Sheets)

Én enkelt Google Sheet med **alle 8 land**, oppdatert daglig av Triple Whale:
- **Sheet ID:** `1IGS1GS7f0pSyOrpk1qEGL_dKdlmpm2G7_pO__Re-0TU` (samme som P&L bot)
- **Tabs:** NO, SE, DK, FI, UK, DE, NL, COM (tab-navn = butikk-kode)
- **Kolonner brukt:**
  - Base: date, order_revenue, spend, orders, new_customer_orders
  - Meta: meta_spend, meta_pixel_revenue, meta_channel_revenue, meta_pixel_nc_revenue
  - Google: google_spend, google_pixel_revenue, google_channel_revenue, google_pixel_nc_revenue
  - TikTok: tiktok_spend, tiktok_pixel_revenue, tiktok_channel_revenue, tiktok_pixel_nc_revenue
- **Revenue format:** Inkluderer MVA i sheetet, må fjernes med VAT-sats per land
- **Data:** De fleste land fra feb 2024. UK fra sep 2024. COM fra feb 2024 (sparsomt).

## Viktige filer

| Fil | Beskrivelse |
|-----|-------------|
| `worker/src/index.ts` | Hovedlogikk, cron-håndtering |
| `worker/src/report.ts` | Generering av rapporter (daily/weekly/monthly) |
| `worker/src/formatting.ts` | Tabell-formatering |
| `worker/src/metrics.ts` | ROAS, NC%, AOV beregninger |
| `worker/src/data.ts` | Data-lasting og filtrering |
| `worker/src/sheets.ts` | Google Sheets-integrasjon (auth + data-henting) |
| `worker/src/types.ts` | TypeScript interfaces |
| `worker/src/shops.ts` | Butikk-konfigurasjon (NO, SE, DK, FI, DE, NL, UK, COM) |
| `worker/src/triplewhale.ts` | Dato-utilities (perioder, YoY-beregning) |
| `worker/src/slack.ts` | Slack webhook-sending |
| `worker/wrangler.toml` | Cloudflare Worker-konfig, cron schedules |
| `marketing-report-spec.md` | Full spesifikasjon av alle rapportformater |

## Kommandoer

```bash
# Deploy
cd worker && npx wrangler deploy

# Preview rapporter
curl https://marketing-slack-bot.seoblogbot.workers.dev/preview-daily
curl https://marketing-slack-bot.seoblogbot.workers.dev/preview-weekly
curl https://marketing-slack-bot.seoblogbot.workers.dev/preview-monthly
```

## Rapport-format

Se [marketing-report-spec.md](marketing-report-spec.md) for fullstendig spesifikasjon.

**Viktige regler:**
- Land uten spend vises IKKE (kun en note)
- Kanaler uten spend vises IKKE
- Pixel-data kan være ufullstendig 1-3 dager etter uke-slutt

**Metrikker:**
- MER = revenue / spend (før refunds)
- Pixel ROAS = {kanal}_pixel_revenue / {kanal}_spend
- Channel ROAS = {kanal}_channel_revenue / {kanal}_spend
- NC ROAS = {kanal}_pixel_nc_revenue / {kanal}_spend
- NC % = new_customer_orders / orders × 100
- AOV = revenue / orders
- vs LY = YoY comparison

**Valuta:** Alltid `kr`, aldri `NOK` i visning

## Gotchas

- **Cloudflare cron**: Bruker 1=Sunday, ikke 1=Monday. Bruk tekstforkortelser (MON, TUE) i toml.
- **Europeiske uker**: Ma-sø, ISO-ukenummerering
- **UK/COM begrenset data**: UK fra sep 2024, COM fra feb 2024 (sparsomt). YoY viser N/A der data mangler.
- **Sommertid/vintertid**: UTC-crons gir automatisk riktig norsk tid (07:00 UTC = 08:00 CET = 09:00 CEST).
- **VAT correction**: Revenue fra sheets inkluderer MVA, må fjernes før beregninger.
