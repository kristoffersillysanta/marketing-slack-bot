# Marketing Report Spec — Slack-rapporter

## Generelt

- **Valuta:** Alt i NOK (konverteres fra lokal valuta)
- **MER:** Beregnes FØR refunds. `MER = revenue / spend`
- **Ukedefinisjon:** Mandag–søndag
- **Land uten spend:** Vises IKKE — kun en note: "⚠️ Ingen spend registrert for: [land] — sjekk TW-oppsett"
- **Kanaler uten spend:** Vises IKKE for det aktuelle landet

---

## 1. Daily Report (sendes hver morgen)

Formål: *"Bruker vi det vi skal, og ser det normalt ut?"*

### Hovedtabell — alle land med spend

```
📊 Daglig rapport — [dato]

Store     Revenue     Spend     MER    NC %    Orders   AOV     vs LY
NO        142 350     18 200    7.8    58%     45       3 163   +22%
DE         38 400      9 100    4.2    51%     22       1 745   +15%
DK         21 200      4 300    4.9    62%     14       1 514   -3%
SE         18 900      3 800    5.0    55%     11       1 718   +8%
──────────────────────────────────────────────────────────────────────
TOTAL     220 850     35 400    6.2    56%     92       2 401   +16%
```

### Kanalfordeling per land — channel ROAS

```
NO: Meta 12 400 (ROAS 6.2) · Google 4 800 (ROAS 3.1) · TikTok 1 000 (ROAS 2.4)
DE: Meta 6 200 (ROAS 3.8) · Google 2 900 (ROAS 4.5)
DK: Meta 3 100 (ROAS 4.2) · Google 1 200 (ROAS 5.8)
```

> 💡 ROAS er channel-rapportert (plattformens egne tall). Pixel ROAS oppdateres i weekly.

---

## 2. Weekly Report (sendes mandag morgen)

Formål: *"Er noe galt? Hvordan ligger vi an?"*

### Hovedtabell — med 3-ukers trend

```
📊 Uke [X] — [dato]–[dato]

Store     Revenue      Spend     MER    NC %    Orders   AOV     vs LY
NO        1 245 000    142 000   8.8    58%     412      3 023   +22%
DE          385 000     68 000   5.7    51%     198      1 944   +15%
DK          198 000     34 000   5.8    62%     124      1 597   -3%
SE          165 000     31 000   5.3    55%     98       1 684   +8%
────────────────────────────────────────────────────────────────────────
TOTAL     1 993 000    275 000   7.2    56%     832      2 396   +16%
```

### 3-ukers trend (total)

```
📈 Trend

         Revenue      Spend     MER    NC %    vs LY
Uke 4    1 993 000    275 000   7.2    56%     +16%
Uke 3    1 842 000    261 000   7.1    54%     +12%
Uke 2    1 680 000    252 000   6.7    52%     +9%
```

### Per kanal — pixel ROAS + channel ROAS + NC ROAS

```
🔍 Kanaler — NO

Kanal      Spend      ROAS (pixel)   ROAS (ch)   NC ROAS
Meta       98 000     5.2            6.8          2.1
Google     36 000     3.8            4.2          1.4
TikTok      8 000     2.1            3.5          1.8

🔍 Kanaler — DE

Kanal      Spend      ROAS (pixel)   ROAS (ch)   NC ROAS
Meta       48 000     3.4            4.9          1.6
Google     20 000     4.1            4.3          1.9
```

> ⏱️ Pixel-data kan oppdateres 1-3 dager etter uke-slutt. Tall fra lørdag/søndag kan være ufullstendige.

> ⚠️ Ingen spend: UK, COM — sjekk TW-oppsett

---

## 3. Monthly Report (sendes 1. i hver måned)

Formål: *"Hva skal vi justere?"*

### Hovedtabell — med 3-måneders trend

```
📊 [Måned] — Månedlig rapport

Store     Revenue       Spend      MER    NC %    Orders   AOV     vs LY
NO        5 420 000     580 000    9.3    57%     1 680    3 226   +18%
DE        1 650 000     285 000    5.8    49%     820      2 012   +24%
DK          840 000     142 000    5.9    61%     510      1 647   +6%
SE          720 000     128 000    5.6    54%     405      1 778   +11%
NL          180 000      32 000    5.6    63%     120      1 500   +42%
FI          145 000      28 000    5.2    58%     95       1 526   +8%
──────────────────────────────────────────────────────────────────────────
TOTAL     8 955 000   1 195 000    7.5    55%     3 630    2 467   +17%
```

### 3-måneders trend (total)

```
📈 Trend

            Revenue       Spend       MER    NC %    vs LY
Mars        8 955 000     1 195 000   7.5    55%     +17%
Februar     7 240 000     1 080 000   6.7    53%     +12%
Januar      6 890 000     1 020 000   6.8    51%     +9%
```

### Per kanal per land — pixel ROAS + channel ROAS + NC ROAS

```
🔍 Kanaler — NO

Kanal      Spend       ROAS (pixel)   ROAS (ch)   NC ROAS   NC Orders
Meta       410 000     5.8            7.2          2.3       412
Google     142 000     4.1            4.5          1.6       98
TikTok      28 000     2.4            3.8          1.9       24

🔍 Kanaler — DE

Kanal      Spend       ROAS (pixel)   ROAS (ch)   NC ROAS   NC Orders
Meta       198 000     3.6            5.1          1.7       186
Google      87 000     4.3            4.6          2.1       112
```

> ⚠️ Ingen spend: UK — sjekk TW-oppsett

---

## Beregninger

| Metrikk | Formel |
|---|---|
| MER | `revenue / total_spend` (før refunds) |
| Pixel ROAS | `{kanal}_pixel_revenue / {kanal}_spend` |
| Channel ROAS | `{kanal}_channel_revenue / {kanal}_spend` |
| NC ROAS | `{kanal}_pixel_nc_revenue / {kanal}_spend` |
| NC % | `new_customer_orders / total_orders × 100` |
| AOV | `revenue / orders` |
| vs LY | `(denne_periode - samme_periode_ifjor) / samme_periode_ifjor × 100` |

---

## Datakilde

Google Sheets (nattlig sync fra TW API). Én fane per land, én rad per dag.
Revenue er inkl. MVA i sheetet — MVA fjernes i rapport-beregningen (bruker P&L sin VAT-sats per land).

---

## Oppsummering forskjeller

| | Daily | Weekly | Monthly |
|---|---|---|---|
| Formål | Spend-sjekk | Er noe galt? | Hva justere? |
| ROAS-type | Channel | Pixel + Channel + NC | Pixel + Channel + NC |
| Trend | Nei | 3 uker | 3 måneder |
| Kanaldetalj | Én linje per land | Tabell per land | Tabell per land + NC orders |
| YoY | Ja | Ja | Ja |
| NC % | Ja | Ja | Ja |
