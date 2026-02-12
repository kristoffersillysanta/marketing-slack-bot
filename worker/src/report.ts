import { DailyReportData, WeeklyReportData, MonthlyReportData } from './types';
import {
  formatMainTable,
  formatChannelBreakdownInline,
  formatChannelTable,
  formatTrendTable,
  formatDate,
  formatDateRange,
  getMonthName,
} from './formatting';

// =============================================================================
// CONTEXT MESSAGES (rotating monkey messages)
// =============================================================================

const DAILY_MESSAGES = [
  "🍌 <!channel> Quick banana check! Daily numbers fresh off the tree:",
  "<!channel> Monkey counted today's bananas 🐒 Here's the haul:",
  "🐒 <!channel> Daily banana report! _munches banana_ Numbers looking good:",
  "<!channel> ooh ooh! Daily report time 🍌 Quick look at the numbers:",
];

const WEEKLY_MESSAGES = [
  "🍌 <!channel> _excited monkey noises_ Weekly banana report! Monkey counted all the bananas. Here's the haul:",
  "<!channel> Monkey sat in the tree all week watching the numbers 🐒 Here's what monkey saw:",
  "🐒 <!channel> Big banana energy this week. _peels banana slowly_ Weekly report incoming:",
  "<!channel> ooh ooh! Weekly report time. Monkey collected ALL the data 🍌 Here:",
];

const MONTHLY_MESSAGES = [
  "🍌🍌🍌 <!channel> Monthly mega banana report! Monkey has been hoarding data all month. Prepare yourselves:",
  "<!channel> _beats chest_ The big one is here 🐒 Monthly banana harvest report:",
  "🐒 <!channel> Monkey spent a whole month in the data jungle. _puts on tiny glasses_ Here's the full haul:",
  "<!channel> ooh ooh! Monthly report time 🍌 Even monkey needs a moment for this much data:",
];

function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

// =============================================================================
// DAILY REPORT
// =============================================================================

/**
 * Generate daily marketing report
 * Purpose: "Are we spending what we should?"
 * @param data Daily report data
 * @returns Formatted Slack message
 */
export function generateDailyReport(data: DailyReportData): string {
  let report = '';

  // Context message
  report += getRandomMessage(DAILY_MESSAGES) + '\n\n';

  // Header (outside code block)
  report += `*📊 Daily Report — ${formatDate(data.date)}*\n\n`;

  // Main table
  report += '```\n';
  report += formatMainTable(data.countries, data.totals);
  report += '```\n\n';

  // Channel breakdown (inline with Channel ROAS only)
  if (data.countries.some(c => c.channels.length > 0)) {
    report += formatChannelBreakdownInline(data.countries) + '\n\n';
  }

  // Info footer
  report += `_💡 ROAS is channel-reported (platform's own numbers). Pixel ROAS updated in weekly._\n`;

  // No-spend warning
  if (data.noSpendCountries.length > 0) {
    report += `_⚠️ No spend: ${data.noSpendCountries.join(', ')} — check TW setup_\n`;
  }

  return report;
}

// =============================================================================
// WEEKLY REPORT
// =============================================================================

/**
 * Generate weekly marketing report
 * Purpose: "Is something wrong?"
 * @param data Weekly report data
 * @returns Formatted Slack message
 */
export function generateWeeklyReport(data: WeeklyReportData): string {
  let report = '';

  // Context message
  report += getRandomMessage(WEEKLY_MESSAGES) + '\n\n';

  // Header (outside code block)
  report += `*📊 Week ${data.weekNumber} — ${formatDateRange(data.startDate, data.endDate)}*\n\n`;

  // Main table
  report += '```\n';
  report += formatMainTable(data.countries, data.totals);
  report += '```\n\n';

  // 3-week trend
  if (data.trend.length > 0) {
    report += '*📈 3-Week Trend*\n\n';
    report += '```\n';
    report += formatTrendTable(data.trend, 'weekly');
    report += '```\n\n';
  }

  // Channel tables per country (Pixel + Channel + NC ROAS)
  for (const country of data.countries) {
    if (country.channels.length > 0) {
      report += `*🔍 Channels — ${country.shop.code}*\n\n`;
      report += '```\n';
      report += formatChannelTable(country, false); // No NC Orders in weekly
      report += '```\n\n';
    }
  }

  // Pixel data warning if recent
  if (data.pixelDataIncomplete) {
    report += '_⏱️ Pixel data may update 1-3 days after week end. Saturday/Sunday numbers may be incomplete._\n\n';
  }

  // No-spend warning
  if (data.noSpendCountries.length > 0) {
    report += `_⚠️ No spend: ${data.noSpendCountries.join(', ')} — check TW setup_\n`;
  }

  return report;
}

// =============================================================================
// MONTHLY REPORT
// =============================================================================

/**
 * Generate monthly marketing report
 * Purpose: "What should we adjust?"
 * @param data Monthly report data
 * @returns Formatted Slack message
 */
export function generateMonthlyReport(data: MonthlyReportData): string {
  let report = '';

  // Context message
  report += getRandomMessage(MONTHLY_MESSAGES) + '\n\n';

  // Header (outside code block)
  const monthName = getMonthName(data.month);
  report += `*📊 ${monthName} ${data.year} — Monthly Report*\n\n`;

  // Main table
  report += '```\n';
  report += formatMainTable(data.countries, data.totals);
  report += '```\n\n';

  // 3-month trend
  if (data.trend.length > 0) {
    report += '*📈 3-Month Trend*\n\n';
    report += '```\n';
    report += formatTrendTable(data.trend, 'monthly');
    report += '```\n\n';
  }

  // Channel tables per country (Pixel + Channel + NC ROAS + NC Orders)
  for (const country of data.countries) {
    if (country.channels.length > 0) {
      report += `*🔍 Channels — ${country.shop.code}*\n\n`;
      report += '```\n';
      report += formatChannelTable(country, true); // Include NC Orders in monthly
      report += '```\n\n';
    }
  }

  // No-spend warning
  if (data.noSpendCountries.length > 0) {
    report += `_⚠️ No spend: ${data.noSpendCountries.join(', ')} — check TW setup_\n`;
  }

  return report;
}
