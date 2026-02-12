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
  report += `*📊 Daglig rapport — ${formatDate(data.date)}*\n\n`;

  // Main table
  report += '```\n';
  report += formatMainTable(data.countries, data.totals);
  report += '```\n\n';

  // Channel breakdown (inline with Channel ROAS only)
  if (data.countries.some(c => c.channels.length > 0)) {
    report += formatChannelBreakdownInline(data.countries) + '\n\n';
  }

  // Info footer
  report += '_💡 ROAS er channel-rapportert (plattformens egne tall). Pixel ROAS oppdateres i weekly._\n';

  // No-spend warning
  if (data.noSpendCountries.length > 0) {
    report += `_⚠️ Ingen spend: ${data.noSpendCountries.join(', ')} — sjekk TW-oppsett_\n`;
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

  // Header
  report += `*📊 Uke ${data.weekNumber} — ${formatDateRange(data.startDate, data.endDate)}*\n\n`;

  // Main table
  report += '```\n';
  report += formatMainTable(data.countries, data.totals);
  report += '```\n\n';

  // 3-week trend
  if (data.trend.length > 0) {
    report += '```\n';
    report += formatTrendTable(data.trend, 'weekly');
    report += '```\n\n';
  }

  // Channel tables per country (Pixel + Channel + NC ROAS)
  for (const country of data.countries) {
    if (country.channels.length > 0) {
      report += '```\n';
      report += formatChannelTable(country, false); // No NC Orders in weekly
      report += '```\n\n';
    }
  }

  // Pixel data warning if recent
  if (data.pixelDataIncomplete) {
    report += '_⏱️ Pixel-data kan oppdateres 1-3 dager etter uke-slutt. Tall fra lørdag/søndag kan være ufullstendige._\n\n';
  }

  // No-spend warning
  if (data.noSpendCountries.length > 0) {
    report += `_⚠️ Ingen spend: ${data.noSpendCountries.join(', ')} — sjekk TW-oppsett_\n`;
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

  // Header
  const monthName = getMonthName(data.month);
  report += `*📊 ${monthName} — Månedlig rapport*\n\n`;

  // Main table
  report += '```\n';
  report += formatMainTable(data.countries, data.totals);
  report += '```\n\n';

  // 3-month trend
  if (data.trend.length > 0) {
    report += '```\n';
    report += formatTrendTable(data.trend, 'monthly');
    report += '```\n\n';
  }

  // Channel tables per country (Pixel + Channel + NC ROAS + NC Orders)
  for (const country of data.countries) {
    if (country.channels.length > 0) {
      report += '```\n';
      report += formatChannelTable(country, true); // Include NC Orders in monthly
      report += '```\n\n';
    }
  }

  // No-spend warning
  if (data.noSpendCountries.length > 0) {
    report += `_⚠️ Ingen spend: ${data.noSpendCountries.join(', ')} — sjekk TW-oppsett_\n`;
  }

  return report;
}
