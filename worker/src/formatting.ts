import { CountryMarketingMetrics, TrendData, Channel, ChannelMetrics } from './types';

// =============================================================================
// BASIC FORMATTING UTILITIES (from P&L bot)
// =============================================================================

export function formatRevenue(num: number): string {
  return Math.round(num).toLocaleString('en-US');
}

export function formatPercent(num: number): string {
  return num.toFixed(1) + '%';
}

/**
 * Format ROAS (1 decimal, or '—' if null)
 */
export function formatROAS(roas: number | null): string {
  if (roas === null) return '—';
  return roas.toFixed(1);
}

/**
 * Format AOV (rounded, no decimals)
 */
export function formatAOV(aov: number): string {
  return Math.round(aov).toLocaleString('en-US');
}

/**
 * Format percentage change with sign
 */
export function formatChange(current: number, previous: number | null): string {
  if (previous === null) return '—';
  if (previous === 0) return current === 0 ? '—' : 'NEW';
  if (previous < 0) return '⚠️ neg.';
  const change = ((current / previous) - 1) * 100;
  if (Math.abs(change) > 999) return change >= 0 ? '>999%' : '<-999%';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * Format YoY comparison (NEW for new markets)
 */
export function formatYoY(current: number, yoy: number | null): string {
  if (yoy === null) return current > 0 ? 'NEW' : '—';
  if (yoy === 0) return current > 0 ? 'NEW' : '—';
  if (yoy < 0) return '⚠️ neg.';
  const change = ((current / yoy) - 1) * 100;
  if (Math.abs(change) > 999) return change >= 0 ? '>999%' : '<-999%';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

// =============================================================================
// MONOSPACE WIDTH CALCULATION (emoji-aware)
// =============================================================================

/**
 * Calculate visual display width for monospace rendering
 * Handles emojis and special characters correctly
 */
export function displayWidth(str: string): number {
  let width = 0;
  const chars = [...str];
  let i = 0;
  while (i < chars.length) {
    const code = chars[i].codePointAt(0) || 0;
    // Regional indicator symbols (flag emojis)
    if (code >= 0x1F1E6 && code <= 0x1F1FF) {
      if (i + 1 < chars.length) {
        const next = chars[i + 1].codePointAt(0) || 0;
        if (next >= 0x1F1E6 && next <= 0x1F1FF) { width += 2; i += 2; continue; }
      }
      width += 1; i++; continue;
    }
    // Variation selectors
    if (code === 0xFE0F || code === 0xFE0E) { i++; continue; }
    // Warning sign
    if (code === 0x26A0) { width += 2; i++; continue; }
    // Dingbats
    if (code >= 0x2700 && code <= 0x27BF) { width += 2; i++; continue; }
    // Most emojis
    if (code >= 0x1F300) { width += 2; i++; continue; }
    width += 1; i++;
  }
  return width;
}

export function padLeft(str: string, width: number): string {
  return ' '.repeat(Math.max(0, width - displayWidth(str))) + str;
}

export function padRight(str: string, width: number): string {
  return str + ' '.repeat(Math.max(0, width - displayWidth(str)));
}

export function separator(headerLine: string): string {
  return '─'.repeat(displayWidth(headerLine));
}

// =============================================================================
// MAIN TABLE FORMATTING
// =============================================================================

/**
 * Format main table: Store | Revenue | Spend | MER | NC % | Orders | AOV | vs LY
 * @param countries Array of country metrics (sorted by revenue DESC)
 * @param totals Total metrics across all countries
 * @returns Formatted table string
 */
export function formatMainTable(
  countries: CountryMarketingMetrics[],
  totals: {
    revenue: number;
    spend: number;
    mer: number;
    ncPercent: number;
    orders: number;
    aov: number;
    vsLY: number | null;
  }
): string {
  const header = `${padRight('Store', 10)} ${padLeft('Revenue', 11)}  ${padLeft('Spend', 9)}  ${padLeft('MER', 7)}  ${padLeft('NC %', 7)}  ${padLeft('Orders', 7)}  ${padLeft('AOV', 9)}  ${padLeft('vs LY', 9)}`;
  let table = header + '\n';
  table += separator(header) + '\n';

  for (const country of countries) {
    const store = padRight(`${country.shop.flag} ${country.shop.code}`, 10);
    const revenue = padLeft(formatRevenue(country.revenue), 11);
    const spend = padLeft(formatRevenue(country.spend), 9);
    const mer = padLeft(formatPercent(country.mer), 7);
    const ncPercent = padLeft(formatPercent(country.ncPercent), 7);
    const orders = padLeft(country.orders.toString(), 7);
    const aov = padLeft(formatAOV(country.aov), 9);
    const vsLY = padLeft(formatYoY(country.revenue, country.revenueYoY), 9);

    table += `${store} ${revenue}  ${spend}  ${mer}  ${ncPercent}  ${orders}  ${aov}  ${vsLY}\n`;
  }

  table += separator(header) + '\n';

  // TOTAL row
  const totalStore = padRight('TOTAL', 10);
  const totalRevenue = padLeft(formatRevenue(totals.revenue), 11);
  const totalSpend = padLeft(formatRevenue(totals.spend), 9);
  const totalMer = padLeft(formatPercent(totals.mer), 7);
  const totalNcPercent = padLeft(formatPercent(totals.ncPercent), 7);
  const totalOrders = padLeft(totals.orders.toString(), 7);
  const totalAov = padLeft(formatAOV(totals.aov), 9);
  const totalVsLY = padLeft(totals.vsLY !== null ? formatChange(0, -totals.vsLY) : '—', 9); // formatChange expects (current, previous)

  table += `${totalStore} ${totalRevenue}  ${totalSpend}  ${totalMer}  ${totalNcPercent}  ${totalOrders}  ${totalAov}  ${totalVsLY}\n`;

  return table;
}

// =============================================================================
// CHANNEL BREAKDOWN FORMATTING
// =============================================================================

/**
 * Format channel breakdown inline (for daily reports)
 * Example: "NO: Meta 12 400 (ROAS 6.2) · Google 4 800 (ROAS 3.1)"
 * @param countries Array of country metrics
 * @returns Formatted inline breakdown (one line per country)
 */
export function formatChannelBreakdownInline(countries: CountryMarketingMetrics[]): string {
  let output = '';

  for (const country of countries) {
    if (country.channels.length === 0) continue;

    const channelStrings = country.channels.map(ch => {
      const roas = ch.channelROAS !== null ? ch.channelROAS.toFixed(1) : '—';
      return `${ch.channel} ${formatRevenue(ch.spend)} (ROAS ${roas})`;
    });

    output += `${country.shop.code}: ${channelStrings.join(' · ')}\n`;
  }

  return output.trim();
}

/**
 * Format detailed channel table (for weekly/monthly reports)
 * @param country Country metrics with channels
 * @param includeNcOrders Include NC Orders column (monthly only)
 * @returns Formatted channel table
 */
export function formatChannelTable(country: CountryMarketingMetrics, includeNcOrders: boolean = false): string {
  if (country.channels.length === 0) return '';

  let table = `🔍 Kanaler — ${country.shop.code}\n\n`;

  // Header
  let header = `${padRight('Kanal', 10)} ${padLeft('Spend', 10)}  ${padLeft('ROAS (pixel)', 14)}  ${padLeft('ROAS (ch)', 11)}  ${padLeft('NC ROAS', 9)}`;
  if (includeNcOrders) {
    header += `  ${padLeft('NC Orders', 10)}`;
  }

  table += header + '\n';
  table += separator(header) + '\n';

  for (const channel of country.channels) {
    const name = padRight(channel.channel, 10);
    const spend = padLeft(formatRevenue(channel.spend), 10);
    const pixelROAS = padLeft(formatROAS(channel.pixelROAS), 14);
    const channelROAS = padLeft(formatROAS(channel.channelROAS), 11);
    const ncROAS = padLeft(formatROAS(channel.ncROAS), 9);

    let row = `${name} ${spend}  ${pixelROAS}  ${channelROAS}  ${ncROAS}`;

    if (includeNcOrders && channel.ncOrders !== undefined) {
      const ncOrders = padLeft(channel.ncOrders.toString(), 10);
      row += `  ${ncOrders}`;
    }

    table += row + '\n';
  }

  return table;
}

// =============================================================================
// TREND TABLE FORMATTING
// =============================================================================

/**
 * Format trend table (3-week or 3-month)
 * @param trends Array of trend data (most recent first)
 * @param type 'weekly' or 'monthly'
 * @returns Formatted trend table
 */
export function formatTrendTable(trends: TrendData[], type: 'weekly' | 'monthly'): string {
  if (trends.length === 0) return '';

  let table = '📈 Trend\n\n';

  const header = `${padRight('', 12)} ${padLeft('Revenue', 12)}  ${padLeft('Spend', 10)}  ${padLeft('MER', 7)}  ${padLeft('NC %', 7)}  ${padLeft('vs LY', 9)}`;
  table += header + '\n';
  table += separator(header) + '\n';

  for (const trend of trends) {
    const period = padRight(trend.period, 12);
    const revenue = padLeft(formatRevenue(trend.revenue), 12);
    const spend = padLeft(formatRevenue(trend.spend), 10);
    const mer = padLeft(formatPercent(trend.mer), 7);
    const ncPercent = padLeft(formatPercent(trend.ncPercent), 7);
    const vsLY = padLeft(trend.vsLY !== null ? formatChange(0, -trend.vsLY) : '—', 9);

    table += `${period} ${revenue}  ${spend}  ${mer}  ${ncPercent}  ${vsLY}\n`;
  }

  return table;
}

// =============================================================================
// DATE FORMATTING
// =============================================================================

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateRange(startDate: Date, endDate: Date): string {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  return `${start} – ${end}`;
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'
];

export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] || 'Unknown';
}
