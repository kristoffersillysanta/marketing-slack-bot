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
} from './triplewhale';
import { sendReport } from './slack';
import { loadAllMarketingData, getAllCountryMetrics, getCountriesWithoutSpend } from './data';
import { calculateWeightedTotals, calculateYoY, isPixelDataIncomplete, aggregatePeriodMetrics, getChannelMetrics } from './metrics';
import { generateDailyReport, generateWeeklyReport, generateMonthlyReport } from './report';
import { DailyReportData, WeeklyReportData, MonthlyReportData, TrendData } from './types';
import { ServiceAccountCredentials } from './sheets';
import { getMonthName } from './formatting';

export interface Env {
  SLACK_WEBHOOK_URL_MARKETING: string;
  GOOGLE_SERVICE_ACCOUNT: string;
  TIMEZONE: string;
}

// Parse Google credentials from environment
function getGoogleCredentials(env: Env): ServiceAccountCredentials {
  const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
  return {
    client_email: creds.client_email,
    private_key: creds.private_key,
  };
}

// =============================================================================
// DAILY REPORT
// =============================================================================

async function sendDailyReport(env: Env): Promise<void> {
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
      mer: weighted.weightedMER,
      ncPercent: weighted.weightedNCPercent,
      orders: weighted.totalOrders,
      aov: weighted.weightedAOV,
      vsLY: null, // TODO: Calculate YoY for totals
    },
    noSpendCountries,
  };

  const report = generateDailyReport(reportData);
  await sendReport(env.SLACK_WEBHOOK_URL_MARKETING, report);
  console.log('Daily report sent!');
}

// =============================================================================
// WEEKLY REPORT
// =============================================================================

async function sendWeeklyReport(env: Env): Promise<void> {
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
      mer: weekWeighted.weightedMER,
      ncPercent: weekWeighted.weightedNCPercent,
      vsLY: null, // TODO: Calculate YoY
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
      mer: weighted.weightedMER,
      ncPercent: weighted.weightedNCPercent,
      orders: weighted.totalOrders,
      aov: weighted.weightedAOV,
      vsLY: null, // TODO: Calculate YoY
    },
    trend,
    noSpendCountries,
    pixelDataIncomplete: isPixelDataIncomplete(weekPeriod.end),
  };

  const report = generateWeeklyReport(reportData);
  await sendReport(env.SLACK_WEBHOOK_URL_MARKETING, report);
  console.log('Weekly report sent!');
}

// =============================================================================
// MONTHLY REPORT
// =============================================================================

async function sendMonthlyReport(env: Env): Promise<void> {
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
      mer: monthWeighted.weightedMER,
      ncPercent: monthWeighted.weightedNCPercent,
      vsLY: null, // TODO: Calculate YoY
    });
  }

  const reportData: MonthlyReportData = {
    month: new Date(monthPeriod.start + 'T00:00:00').getMonth() + 1, // 1-indexed
    year: new Date(monthPeriod.start + 'T00:00:00').getFullYear(),
    countries,
    totals: {
      revenue: weighted.totalRevenue,
      spend: weighted.totalSpend,
      mer: weighted.weightedMER,
      ncPercent: weighted.weightedNCPercent,
      orders: weighted.totalOrders,
      aov: weighted.weightedAOV,
      vsLY: null, // TODO: Calculate YoY
    },
    trend,
    noSpendCountries,
  };

  const report = generateMonthlyReport(reportData);
  await sendReport(env.SLACK_WEBHOOK_URL_MARKETING, report);
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
      mer: weighted.weightedMER,
      ncPercent: weighted.weightedNCPercent,
      orders: weighted.totalOrders,
      aov: weighted.weightedAOV,
      vsLY: null,
    },
    noSpendCountries,
  };

  const report = generateDailyReport(reportData);
  return new Response(report, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
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
      mer: weekWeighted.weightedMER,
      ncPercent: weekWeighted.weightedNCPercent,
      vsLY: null,
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
      mer: weighted.weightedMER,
      ncPercent: weighted.weightedNCPercent,
      orders: weighted.totalOrders,
      aov: weighted.weightedAOV,
      vsLY: null,
    },
    trend,
    noSpendCountries,
    pixelDataIncomplete: isPixelDataIncomplete(weekPeriod.end),
  };

  const report = generateWeeklyReport(reportData);
  return new Response(report, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
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
      mer: monthWeighted.weightedMER,
      ncPercent: monthWeighted.weightedNCPercent,
      vsLY: null,
    });
  }

  const reportData: MonthlyReportData = {
    month: new Date(monthPeriod.start + 'T00:00:00').getMonth() + 1,
    year: new Date(monthPeriod.start + 'T00:00:00').getFullYear(),
    countries,
    totals: {
      revenue: weighted.totalRevenue,
      spend: weighted.totalSpend,
      mer: weighted.weightedMER,
      ncPercent: weighted.weightedNCPercent,
      orders: weighted.totalOrders,
      aov: weighted.weightedAOV,
      vsLY: null,
    },
    trend,
    noSpendCountries,
  };

  const report = generateMonthlyReport(reportData);
  return new Response(report, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// =============================================================================
// WORKER ENTRY POINT
// =============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Preview endpoints
    if (url.pathname === '/preview-daily') return await previewDailyReport(env);
    if (url.pathname === '/preview-weekly') return await previewWeeklyReport(env);
    if (url.pathname === '/preview-monthly') return await previewMonthlyReport(env);

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
