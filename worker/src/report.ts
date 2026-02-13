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
// CONTEXT MESSAGES (rotating cat messages)
// =============================================================================

const DAILY_MESSAGES = [
  "Meow <!channel> 🐱 Kitty checked your numbers overnight. Here:",
  "pspsps <!channel> daily marketing report. You're welcome 🐈",
  "Good morning <!channel> 😼 Kitty watched your campaigns yesterday. Here's what happened:",
  "Another day, another report <!channel> 🐾 Kitty delivered. As always:",
  "Kitty walked across the keyboard and accidentally pulled your daily report <!channel> Here 🐱",
];

const WEEKLY_MESSAGES = [
  "Meow meow <!channel> 😼 Kitty has been smashing the keyboard all week. Here's what came out:",
  "Weekly report time <!channel> 🐾 Kitty sat on the laptop all week watching your numbers:",
  "pspsps <!channel> Kitty tracked everything this week. You're welcome 🐱",
  "Seven days of keyboard smashing later <!channel> here's your weekly report 🐈",
];

const MONTHLY_MESSAGES = [
  "MEOW <!channel> 🐱🐱🐱 Kitty has been hoarding data all month. Here:",
  "30 days of keyboard smashing <!channel> and this is what Kitty found 😼",
  "The big one <!channel> 🐾 Kitty spent a whole month on this. You may pet me now:",
  "Monthly report time <!channel> Kitty walked across every spreadsheet this month. Fine, you can have it 🐈",
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

  // Header
  report += `*🚀 DAILY MARKETING REPORT*\n`;
  report += `_${formatDate(data.date)}_\n\n`;

  // Context message
  report += getRandomMessage(DAILY_MESSAGES) + '\n\n';

  // Main table with header (no YoY for daily)
  report += `*⚡ MAIN METRICS — ${formatDate(data.date)}*\n\n`;
  report += '```\n';
  report += formatMainTable(data.countries, data.totals, false);
  report += '```\n\n';

  // Channel breakdown (inline with Channel ROAS only)
  if (data.countries.some(c => c.channels.length > 0)) {
    report += '*📊 CHANNEL BREAKDOWN*\n';
    report += '_Market · Channel Spend · Channel ROAS · Share of spend (only markets and channels with spend)_\n\n';
    report += '```\n';
    report += formatChannelBreakdownInline(data.countries) + '\n';
    report += '```\n\n';
  }

  // WTD (Week-to-Date) — Wed-Fri only
  if (data.wtd) {
    report += `*📅 WEEK TO DATE (${data.wtd.label})*\n\n`;
    report += '```\n';
    report += formatMainTable(data.wtd.countries, data.wtd.totals, false);
    report += '```\n\n';
  }

  // Condensed footer (one line, only relevant info)
  const footerParts = [];
  footerParts.push('💡 ROAS is channel-reported (platform\'s own numbers). Pixel ROAS updated in weekly.');
  footerParts.push('💰 Revenue figures include VAT (gross). Spend is ex-VAT.');
  if (data.noSpendCountries.length > 0) {
    footerParts.push(`⚠️ No spend: ${data.noSpendCountries.join(', ')} — check TW setup`);
  }
  report += `_${footerParts.join(' ')}_\n`;

  return report;
}

// =============================================================================
// WEEKLY REPORT (split into multiple messages)
// =============================================================================

/**
 * Generate weekly marketing report
 * Purpose: "Is something wrong?"
 * @param data Weekly report data
 * @returns Array of Slack messages (main report + MTD if applicable)
 */
export function generateWeeklyReport(data: WeeklyReportData): string[] {
  const messages: string[] = [];
  let report = '';

  // Header
  report += `*🚀 WEEKLY MARKETING REPORT*\n`;
  report += `_Week ${data.weekNumber}, ${data.year} — ${formatDateRange(data.startDate, data.endDate)}_\n\n`;

  // Context message
  report += getRandomMessage(WEEKLY_MESSAGES) + '\n\n';

  // Main table
  report += '```\n';
  report += formatMainTable(data.countries, data.totals);
  report += '```\n\n';

  // 3-week trend
  if (data.trend.length > 0) {
    report += '*📈 3-WEEK TREND*\n\n';
    report += '```\n';
    report += formatTrendTable(data.trend, 'weekly');
    report += '```\n\n';
  }

  // Channel tables per country (Pixel + Channel + NC ROAS)
  for (const country of data.countries) {
    if (country.channels.length > 0) {
      report += `*🔍 CHANNELS — ${country.shop.flag} ${country.shop.code}*\n\n`;
      report += '```\n';
      report += formatChannelTable(country, false); // No NC Orders in weekly
      report += '```\n\n';
    }
  }

  // Build footer
  const footerParts = [];
  if (data.pixelDataIncomplete) {
    footerParts.push('⏱️ Pixel data may update 1-3 days after week end. Saturday/Sunday numbers may be incomplete.');
  }
  footerParts.push('💰 Revenue figures include VAT (gross). Spend is ex-VAT.');
  if (data.noSpendCountries.length > 0) {
    footerParts.push(`⚠️ No spend: ${data.noSpendCountries.join(', ')} — check TW setup`);
  }
  const footer = `_${footerParts.join(' ')}_\n`;

  if (data.mtd) {
    // No footer on first message — it goes on the MTD message
    messages.push(report);

    let mtdMsg = '';
    mtdMsg += `*📅 MONTH TO DATE (${data.mtd.label})*\n\n`;
    mtdMsg += '```\n';
    mtdMsg += formatMainTable(data.mtd.countries, data.mtd.totals);
    mtdMsg += '```\n\n';
    mtdMsg += footer;
    messages.push(mtdMsg);
  } else {
    report += footer;
    messages.push(report);
  }

  return messages;
}

// =============================================================================
// MONTHLY REPORT (split into multiple messages)
// =============================================================================

/**
 * Generate monthly marketing report
 * Purpose: "What should we adjust?"
 * @param data Monthly report data
 * @returns Array of Slack messages (main report + channel tables)
 */
export function generateMonthlyReport(data: MonthlyReportData): string[] {
  const messages: string[] = [];
  let report = '';

  // Header
  const monthName = getMonthName(data.month);
  report += `*🚀 MONTHLY MARKETING REPORT*\n`;
  report += `_${monthName} ${data.year}_\n\n`;

  // Context message
  report += getRandomMessage(MONTHLY_MESSAGES) + '\n\n';

  // Main table
  report += '```\n';
  report += formatMainTable(data.countries, data.totals);
  report += '```\n\n';

  // 3-month trend
  if (data.trend.length > 0) {
    report += '*📈 3-MONTH TREND*\n\n';
    report += '```\n';
    report += formatTrendTable(data.trend, 'monthly');
    report += '```\n\n';
  }

  // Condensed footer (one line, only relevant info)
  const footerParts = [];
  footerParts.push('💰 Revenue figures include VAT (gross). Spend is ex-VAT.');
  if (data.noSpendCountries.length > 0) {
    footerParts.push(`⚠️ No spend: ${data.noSpendCountries.join(', ')} — check TW setup`);
  }
  report += `_${footerParts.join(' ')}_\n`;

  messages.push(report);

  // Channel tables as separate message
  const hasChannels = data.countries.some(c => c.channels.length > 0);
  if (hasChannels) {
    let channelMsg = '';
    for (const country of data.countries) {
      if (country.channels.length > 0) {
        channelMsg += `*🔍 CHANNELS — ${country.shop.flag} ${country.shop.code}*\n\n`;
        channelMsg += '```\n';
        channelMsg += formatChannelTable(country, true); // Include NC Orders in monthly
        channelMsg += '```\n\n';
      }
    }
    messages.push(channelMsg.trim());
  }

  return messages;
}
