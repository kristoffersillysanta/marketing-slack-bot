import { SHOPS } from './shops';
import {
  getYesterdayPeriod,
  getWeekPeriod,
  getWeekNumber,
  getSameDayLastYear,
  getSameWeekLastYear,
  getPreviousMonthPeriod,
  getSameMonthLastYear,
  getMonthPeriod,
  getWTDPeriod,
  getMTDPeriod,
} from './triplewhale';
import { sendBlockMessages } from './slack';
import { loadAllMarketingData, getAllCountryMetrics, getCountriesWithoutSpend } from './data';
import { calculateWeightedTotals, isPixelDataIncomplete } from './metrics';
import { generateDailyReport, generateWeeklyReport, generateMonthlyReport } from './report';
import { Env, SlackBlock, DailyReportData, WeeklyReportData, MonthlyReportData, TrendData, CountryMarketingMetrics } from './types';
import { ServiceAccountCredentials } from './sheets';
import { getMonthName } from './formatting';
import { handleMCPRequest, handleMCPSSE } from './mcp/server';

// Parse Google credentials from environment
function getGoogleCredentials(env: Env): ServiceAccountCredentials {
  const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
  return {
    client_email: creds.client_email,
    private_key: creds.private_key,
  };
}

// Calculate total previous year revenue from countries (for YoY on TOTAL row)
function getTotalPrevYearRevenue(countries: CountryMarketingMetrics[]): number | null {
  const total = countries.reduce((sum, c) => sum + (c.revenueYoY ?? 0), 0);
  return total > 0 ? total : null;
}

// Helper: convert blocks to plain text for preview endpoints
function blocksToText(messages: SlackBlock[][]): string {
  return messages.map(blocks =>
    blocks.map(block => {
      if (block.type === 'header') return `\n=== ${block.text.text} ===\n`;
      if (block.type === 'section') return block.text.text;
      if (block.type === 'context') return block.elements.map(e => e.text).join('\n');
      if (block.type === 'rich_text') return '```\n' + block.elements.map(e => e.elements.map(t => t.text).join('')).join('') + '```';
      if (block.type === 'divider') return '---';
      return '';
    }).join('\n')
  ).join('\n\n---\n\n');
}

// =============================================================================
// DAILY REPORT
// =============================================================================

async function sendDailyReport(env: Env, webhookUrl?: string): Promise<void> {
  console.log('Generating daily marketing report...');

  const credentials = getGoogleCredentials(env);
  const allData = await loadAllMarketingData(credentials);

  // Yesterday's data
  const yesterdayPeriod = getYesterdayPeriod();
  const yesterdayYoY = getSameDayLastYear(yesterdayPeriod);

  // Get countries with spend
  const countries = getAllCountryMetrics(
    allData,
    yesterdayPeriod,
    yesterdayPeriod,
    yesterdayYoY,
    yesterdayYoY,
    false // No NC Orders in daily
  );

  // Calculate weighted totals
  const weighted = calculateWeightedTotals(countries);

  // Get no-spend countries
  const noSpendCountries = getCountriesWithoutSpend(allData, yesterdayPeriod, yesterdayPeriod);

  const reportData: DailyReportData = {
    date: new Date(yesterdayPeriod + 'T00:00:00'),
    countries,
    totals: {
      revenue: weighted.totalRevenue,
      spend: weighted.totalSpend,
      roas: weighted.weightedROAS,
      ncRoas: weighted.weightedNCROAS,
      ncPercent: weighted.weightedNCPercent,
      orders: weighted.totalOrders,
      aov: weighted.weightedAOV,
      vsLY: getTotalPrevYearRevenue(countries),
    },
    noSpendCountries,
  };

  // WTD: only Wed-Fri (today is the day the report runs, yesterday is the data day)
  const today = new Date();
  const todayDayOfWeek = today.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
  if (todayDayOfWeek >= 3 && todayDayOfWeek <= 5) {
    const yesterday = new Date(yesterdayPeriod + 'T00:00:00');
    const wtdPeriod = getWTDPeriod(yesterday);
    console.log(`WTD: ${wtdPeriod.start} to ${wtdPeriod.end} (${wtdPeriod.label})`);

    const wtdCountries = getAllCountryMetrics(allData, wtdPeriod.start, wtdPeriod.end, wtdPeriod.yoyStart, wtdPeriod.yoyEnd, false);
    const wtdWeighted = calculateWeightedTotals(wtdCountries);

    reportData.wtd = {
      label: wtdPeriod.label,
      countries: wtdCountries,
      totals: {
        revenue: wtdWeighted.totalRevenue,
        spend: wtdWeighted.totalSpend,
        roas: wtdWeighted.weightedROAS,
        ncRoas: wtdWeighted.weightedNCROAS,
        ncPercent: wtdWeighted.weightedNCPercent,
        orders: wtdWeighted.totalOrders,
        aov: wtdWeighted.weightedAOV,
        vsLY: getTotalPrevYearRevenue(wtdCountries),
      },
    };
  }

  const messages = generateDailyReport(reportData);
  await sendBlockMessages(webhookUrl ?? env.SLACK_WEBHOOK_URL_MARKETING, messages);
  console.log('Daily report sent!');
}

// =============================================================================
// WEEKLY REPORT
// =============================================================================

async function sendWeeklyReport(env: Env, webhookUrl?: string): Promise<void> {
  console.log('Generating weekly marketing report...');

  const credentials = getGoogleCredentials(env);
  const allData = await loadAllMarketingData(credentials);

  // Previous week (Mon-Sun)
  const weekPeriod = getWeekPeriod(1); // 1 week ago
  const weekYoY = getSameWeekLastYear(weekPeriod.start);

  // Get countries with spend
  const countries = getAllCountryMetrics(
    allData,
    weekPeriod.start,
    weekPeriod.end,
    weekYoY.start,
    weekYoY.end,
    false // No NC Orders in weekly
  );

  // Calculate weighted totals
  const weighted = calculateWeightedTotals(countries);

  // Get no-spend countries
  const noSpendCountries = getCountriesWithoutSpend(allData, weekPeriod.start, weekPeriod.end);

  // Generate 3-week trend
  const trend: TrendData[] = [];
  for (let weeksAgo = 1; weeksAgo <= 3; weeksAgo++) {
    const period = getWeekPeriod(weeksAgo);
    const yoy = getSameWeekLastYear(period.start);
    const weekNum = getWeekNumber(new Date(period.start + 'T00:00:00'));

    const weekCountries = getAllCountryMetrics(allData, period.start, period.end, yoy.start, yoy.end, false);
    const weekWeighted = calculateWeightedTotals(weekCountries);

    trend.push({
      period: `Uke ${weekNum}`,
      revenue: weekWeighted.totalRevenue,
      spend: weekWeighted.totalSpend,
      roas: weekWeighted.weightedROAS,
      ncRoas: weekWeighted.weightedNCROAS,
      ncPercent: weekWeighted.weightedNCPercent,
      vsLY: getTotalPrevYearRevenue(weekCountries),
    });
  }

  const reportData: WeeklyReportData = {
    weekNumber: getWeekNumber(new Date(weekPeriod.start + 'T00:00:00')),
    year: new Date(weekPeriod.start + 'T00:00:00').getFullYear(),
    startDate: new Date(weekPeriod.start + 'T00:00:00'),
    endDate: new Date(weekPeriod.end + 'T00:00:00'),
    countries,
    totals: {
      revenue: weighted.totalRevenue,
      spend: weighted.totalSpend,
      roas: weighted.weightedROAS,
      ncRoas: weighted.weightedNCROAS,
      ncPercent: weighted.weightedNCPercent,
      orders: weighted.totalOrders,
      aov: weighted.weightedAOV,
      vsLY: getTotalPrevYearRevenue(countries),
    },
    trend,
    noSpendCountries,
    pixelDataIncomplete: isPixelDataIncomplete(weekPeriod.end),
  };

  // MTD: skip when month started on the same Monday as the reported week
  const lastWeekSunday = new Date(weekPeriod.end + 'T00:00:00');
  const mtdPeriod = getMTDPeriod(lastWeekSunday);
  if (mtdPeriod.start !== weekPeriod.start) {
    console.log(`MTD: ${mtdPeriod.start} to ${mtdPeriod.end} (${mtdPeriod.label})`);

    const mtdCountries = getAllCountryMetrics(allData, mtdPeriod.start, mtdPeriod.end, mtdPeriod.yoyStart, mtdPeriod.yoyEnd, false);
    const mtdWeighted = calculateWeightedTotals(mtdCountries);

    reportData.mtd = {
      label: mtdPeriod.label,
      countries: mtdCountries,
      totals: {
        revenue: mtdWeighted.totalRevenue,
        spend: mtdWeighted.totalSpend,
        roas: mtdWeighted.weightedROAS,
        ncRoas: mtdWeighted.weightedNCROAS,
        ncPercent: mtdWeighted.weightedNCPercent,
        orders: mtdWeighted.totalOrders,
        aov: mtdWeighted.weightedAOV,
        vsLY: getTotalPrevYearRevenue(mtdCountries),
      },
    };
  }

  const messages = generateWeeklyReport(reportData);
  await sendBlockMessages(webhookUrl ?? env.SLACK_WEBHOOK_URL_MARKETING, messages);
  console.log('Weekly report sent!');
}

// =============================================================================
// MONTHLY REPORT
// =============================================================================

async function sendMonthlyReport(env: Env, webhookUrl?: string): Promise<void> {
  console.log('Generating monthly marketing report...');

  const credentials = getGoogleCredentials(env);
  const allData = await loadAllMarketingData(credentials);

  // Previous month
  const monthPeriod = getPreviousMonthPeriod();
  const monthYoY = getSameMonthLastYear(monthPeriod.start);

  // Get countries with spend
  const countries = getAllCountryMetrics(
    allData,
    monthPeriod.start,
    monthPeriod.end,
    monthYoY.start,
    monthYoY.end,
    true // Include NC Orders in monthly
  );

  // Calculate weighted totals
  const weighted = calculateWeightedTotals(countries);

  // Get no-spend countries
  const noSpendCountries = getCountriesWithoutSpend(allData, monthPeriod.start, monthPeriod.end);

  // Generate 3-month trend
  const trend: TrendData[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  for (let monthsAgo = 1; monthsAgo <= 3; monthsAgo++) {
    let month = currentMonth - monthsAgo;
    let year = currentYear;

    // Handle year boundary
    if (month < 0) {
      month += 12;
      year -= 1;
    }

    const period = getMonthPeriod(month + 1, year); // getMonthPeriod uses 1-indexed months
    const yoy = getSameMonthLastYear(period.start);

    const monthCountries = getAllCountryMetrics(allData, period.start, period.end, yoy.start, yoy.end, true);
    const monthWeighted = calculateWeightedTotals(monthCountries);

    trend.push({
      period: getMonthName(month + 1),
      revenue: monthWeighted.totalRevenue,
      spend: monthWeighted.totalSpend,
      roas: monthWeighted.weightedROAS,
      ncRoas: monthWeighted.weightedNCROAS,
      ncPercent: monthWeighted.weightedNCPercent,
      vsLY: getTotalPrevYearRevenue(monthCountries),
    });
  }

  const reportData: MonthlyReportData = {
    month: new Date(monthPeriod.start + 'T00:00:00').getMonth() + 1, // 1-indexed
    year: new Date(monthPeriod.start + 'T00:00:00').getFullYear(),
    countries,
    totals: {
      revenue: weighted.totalRevenue,
      spend: weighted.totalSpend,
      roas: weighted.weightedROAS,
      ncRoas: weighted.weightedNCROAS,
      ncPercent: weighted.weightedNCPercent,
      orders: weighted.totalOrders,
      aov: weighted.weightedAOV,
      vsLY: getTotalPrevYearRevenue(countries),
    },
    trend,
    noSpendCountries,
  };

  const messages = generateMonthlyReport(reportData);
  await sendBlockMessages(webhookUrl ?? env.SLACK_WEBHOOK_URL_MARKETING, messages);
  console.log('Monthly report sent!');
}

// =============================================================================
// PREVIEW ENDPOINTS
// =============================================================================

async function previewDailyReport(env: Env): Promise<Response> {
  const credentials = getGoogleCredentials(env);
  const allData = await loadAllMarketingData(credentials);

  const yesterdayPeriod = getYesterdayPeriod();
  const yesterdayYoY = getSameDayLastYear(yesterdayPeriod);

  const countries = getAllCountryMetrics(allData, yesterdayPeriod, yesterdayPeriod, yesterdayYoY, yesterdayYoY, false);
  const weighted = calculateWeightedTotals(countries);
  const noSpendCountries = getCountriesWithoutSpend(allData, yesterdayPeriod, yesterdayPeriod);

  const reportData: DailyReportData = {
    date: new Date(yesterdayPeriod + 'T00:00:00'),
    countries,
    totals: {
      revenue: weighted.totalRevenue,
      spend: weighted.totalSpend,
      roas: weighted.weightedROAS,
      ncRoas: weighted.weightedNCROAS,
      ncPercent: weighted.weightedNCPercent,
      orders: weighted.totalOrders,
      aov: weighted.weightedAOV,
      vsLY: getTotalPrevYearRevenue(countries),
    },
    noSpendCountries,
  };

  // Always show WTD in preview (regardless of day)
  const yesterday = new Date(yesterdayPeriod + 'T00:00:00');
  const wtdPeriod = getWTDPeriod(yesterday);
  const wtdCountries = getAllCountryMetrics(allData, wtdPeriod.start, wtdPeriod.end, wtdPeriod.yoyStart, wtdPeriod.yoyEnd, false);
  const wtdWeighted = calculateWeightedTotals(wtdCountries);
  reportData.wtd = {
    label: wtdPeriod.label,
    countries: wtdCountries,
    totals: {
      revenue: wtdWeighted.totalRevenue,
      spend: wtdWeighted.totalSpend,
      roas: wtdWeighted.weightedROAS,
      ncRoas: wtdWeighted.weightedNCROAS,
      ncPercent: wtdWeighted.weightedNCPercent,
      orders: wtdWeighted.totalOrders,
      aov: wtdWeighted.weightedAOV,
      vsLY: getTotalPrevYearRevenue(wtdCountries),
    },
  };

  const messages = generateDailyReport(reportData);
  return new Response(blocksToText(messages), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function previewWeeklyReport(env: Env): Promise<Response> {
  const credentials = getGoogleCredentials(env);
  const allData = await loadAllMarketingData(credentials);

  const weekPeriod = getWeekPeriod(1);
  const weekYoY = getSameWeekLastYear(weekPeriod.start);

  const countries = getAllCountryMetrics(allData, weekPeriod.start, weekPeriod.end, weekYoY.start, weekYoY.end, false);
  const weighted = calculateWeightedTotals(countries);
  const noSpendCountries = getCountriesWithoutSpend(allData, weekPeriod.start, weekPeriod.end);

  const trend: TrendData[] = [];
  for (let weeksAgo = 1; weeksAgo <= 3; weeksAgo++) {
    const period = getWeekPeriod(weeksAgo);
    const yoy = getSameWeekLastYear(period.start);
    const weekNum = getWeekNumber(new Date(period.start + 'T00:00:00'));

    const weekCountries = getAllCountryMetrics(allData, period.start, period.end, yoy.start, yoy.end, false);
    const weekWeighted = calculateWeightedTotals(weekCountries);

    trend.push({
      period: `Week ${weekNum}`,
      revenue: weekWeighted.totalRevenue,
      spend: weekWeighted.totalSpend,
      roas: weekWeighted.weightedROAS,
      ncRoas: weekWeighted.weightedNCROAS,
      ncPercent: weekWeighted.weightedNCPercent,
      vsLY: getTotalPrevYearRevenue(weekCountries),
    });
  }

  const reportData: WeeklyReportData = {
    weekNumber: getWeekNumber(new Date(weekPeriod.start + 'T00:00:00')),
    year: new Date(weekPeriod.start + 'T00:00:00').getFullYear(),
    startDate: new Date(weekPeriod.start + 'T00:00:00'),
    endDate: new Date(weekPeriod.end + 'T00:00:00'),
    countries,
    totals: {
      revenue: weighted.totalRevenue,
      spend: weighted.totalSpend,
      roas: weighted.weightedROAS,
      ncRoas: weighted.weightedNCROAS,
      ncPercent: weighted.weightedNCPercent,
      orders: weighted.totalOrders,
      aov: weighted.weightedAOV,
      vsLY: getTotalPrevYearRevenue(countries),
    },
    trend,
    noSpendCountries,
    pixelDataIncomplete: isPixelDataIncomplete(weekPeriod.end),
  };

  // Always show MTD in preview (regardless of week position)
  const previewSunday = new Date(weekPeriod.end + 'T00:00:00');
  const mtdPeriod = getMTDPeriod(previewSunday);
  if (mtdPeriod.start !== weekPeriod.start) {
    const mtdCountries = getAllCountryMetrics(allData, mtdPeriod.start, mtdPeriod.end, mtdPeriod.yoyStart, mtdPeriod.yoyEnd, false);
    const mtdWeighted = calculateWeightedTotals(mtdCountries);
    reportData.mtd = {
      label: mtdPeriod.label,
      countries: mtdCountries,
      totals: {
        revenue: mtdWeighted.totalRevenue,
        spend: mtdWeighted.totalSpend,
        roas: mtdWeighted.weightedROAS,
        ncRoas: mtdWeighted.weightedNCROAS,
        ncPercent: mtdWeighted.weightedNCPercent,
        orders: mtdWeighted.totalOrders,
        aov: mtdWeighted.weightedAOV,
        vsLY: getTotalPrevYearRevenue(mtdCountries),
      },
    };
  }

  const messages = generateWeeklyReport(reportData);
  return new Response(blocksToText(messages), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function previewMonthlyReport(env: Env): Promise<Response> {
  const credentials = getGoogleCredentials(env);
  const allData = await loadAllMarketingData(credentials);

  const monthPeriod = getPreviousMonthPeriod();
  const monthYoY = getSameMonthLastYear(monthPeriod.start);

  const countries = getAllCountryMetrics(allData, monthPeriod.start, monthPeriod.end, monthYoY.start, monthYoY.end, true);
  const weighted = calculateWeightedTotals(countries);
  const noSpendCountries = getCountriesWithoutSpend(allData, monthPeriod.start, monthPeriod.end);

  const trend: TrendData[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  for (let monthsAgo = 1; monthsAgo <= 3; monthsAgo++) {
    let month = currentMonth - monthsAgo;
    let year = currentYear;

    if (month < 0) {
      month += 12;
      year -= 1;
    }

    const period = getMonthPeriod(month + 1, year);
    const yoy = getSameMonthLastYear(period.start);

    const monthCountries = getAllCountryMetrics(allData, period.start, period.end, yoy.start, yoy.end, true);
    const monthWeighted = calculateWeightedTotals(monthCountries);

    trend.push({
      period: getMonthName(month + 1),
      revenue: monthWeighted.totalRevenue,
      spend: monthWeighted.totalSpend,
      roas: monthWeighted.weightedROAS,
      ncRoas: monthWeighted.weightedNCROAS,
      ncPercent: monthWeighted.weightedNCPercent,
      vsLY: getTotalPrevYearRevenue(monthCountries),
    });
  }

  const reportData: MonthlyReportData = {
    month: new Date(monthPeriod.start + 'T00:00:00').getMonth() + 1,
    year: new Date(monthPeriod.start + 'T00:00:00').getFullYear(),
    countries,
    totals: {
      revenue: weighted.totalRevenue,
      spend: weighted.totalSpend,
      roas: weighted.weightedROAS,
      ncRoas: weighted.weightedNCROAS,
      ncPercent: weighted.weightedNCPercent,
      orders: weighted.totalOrders,
      aov: weighted.weightedAOV,
      vsLY: getTotalPrevYearRevenue(countries),
    },
    trend,
    noSpendCountries,
  };

  const messages = generateMonthlyReport(reportData);
  return new Response(blocksToText(messages), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// =============================================================================
// WORKER ENTRY POINT
// =============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // MCP endpoints
    if (url.pathname === '/sse') {
      return handleMCPSSE(request, env);
    }
    if (url.pathname === '/mcp') {
      return handleMCPRequest(request, env);
    }

    // Preview endpoints
    if (url.pathname === '/preview-daily') return await previewDailyReport(env);
    if (url.pathname === '/preview-weekly') return await previewWeeklyReport(env);
    if (url.pathname === '/preview-monthly') return await previewMonthlyReport(env);

    // Send test endpoints (uses test webhook)
    if (url.pathname === '/send-daily') {
      await sendDailyReport(env, env.SLACK_WEBHOOK_URL_MARKETING_TEST);
      return new Response('Daily report sent to test channel!', { status: 200 });
    }
    if (url.pathname === '/send-weekly') {
      await sendWeeklyReport(env, env.SLACK_WEBHOOK_URL_MARKETING_TEST);
      return new Response('Weekly report sent to test channel!', { status: 200 });
    }
    if (url.pathname === '/send-monthly') {
      await sendMonthlyReport(env, env.SLACK_WEBHOOK_URL_MARKETING_TEST);
      return new Response('Monthly report sent to test channel!', { status: 200 });
    }

    return new Response('Marketing Slack Bot', { status: 200 });
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const dayOfMonth = now.getDate();
    const hour = now.getUTCHours();

    console.log(`Cron triggered: ${now.toISOString()} (day=${dayOfWeek}, hour=${hour})`);

    // Daily: Tue-Fri 07:00 UTC
    if (dayOfWeek >= 2 && dayOfWeek <= 5 && hour === 7) {
      await sendDailyReport(env);
    }

    // Weekly: Mon 07:00 UTC
    if (dayOfWeek === 1 && hour === 7) {
      await sendWeeklyReport(env);
    }

    // Monthly: 1st of month 08:00 UTC
    if (dayOfMonth === 1 && hour === 8) {
      await sendMonthlyReport(env);
    }
  },
};
