import { SHOPS, Shop } from './shops';
import { MarketingDailyMetrics, ServiceAccountCredentials, loadAllShopData, getMetricsForPeriod } from './sheets';
import { aggregatePeriodMetrics, getChannelMetrics, calculateYoY } from './metrics';
import { CountryMarketingMetrics, PeriodMarketingMetrics } from './types';

// =============================================================================
// VAT CORRECTION
// =============================================================================

/**
 * Apply VAT correction to revenue (remove VAT)
 * Triple Whale reports order_revenue as VAT-inclusive.
 * We divide by (1 + vatRate) to get ex-VAT figures.
 * @param allData Map of shop code to daily metrics
 */
export function applyVatCorrection(allData: Map<string, MarketingDailyMetrics[]>): void {
  for (const shop of SHOPS) {
    const vatDivisor = 1 + shop.vatRate;
    if (vatDivisor === 1) continue; // No VAT

    const shopData = allData.get(shop.code);
    if (!shopData) continue;

    for (const day of shopData) {
      day.orderRevenue /= vatDivisor;
      // Channel revenues also need VAT correction
      day.metaPixelRevenue /= vatDivisor;
      day.metaChannelRevenue /= vatDivisor;
      day.metaPixelNcRevenue /= vatDivisor;
      day.googlePixelRevenue /= vatDivisor;
      day.googleChannelRevenue /= vatDivisor;
      day.googlePixelNcRevenue /= vatDivisor;
      day.tiktokPixelRevenue /= vatDivisor;
      day.tiktokChannelRevenue /= vatDivisor;
      day.tiktokPixelNcRevenue /= vatDivisor;
    }
  }
}

// =============================================================================
// DATA LOADING
// =============================================================================

/**
 * Load all marketing data from Google Sheets
 * @param credentials Google service account credentials
 * @returns Map of shop code to daily metrics (VAT-corrected)
 */
export async function loadAllMarketingData(
  credentials: ServiceAccountCredentials
): Promise<Map<string, MarketingDailyMetrics[]>> {
  const shopCodes = SHOPS.map(s => s.code);
  const allData = await loadAllShopData(credentials, shopCodes);

  // Apply VAT correction
  applyVatCorrection(allData);

  return allData;
}

// =============================================================================
// FILTERING
// =============================================================================

/**
 * Filter countries to only those with spend > 0 in the period
 * @param allData Map of shop code to daily metrics
 * @param startDate Period start date (YYYY-MM-DD)
 * @param endDate Period end date (YYYY-MM-DD)
 * @returns Array of shop codes with spend > 0
 */
export function filterCountriesWithSpend(
  allData: Map<string, MarketingDailyMetrics[]>,
  startDate: string,
  endDate: string
): string[] {
  const countriesWithSpend: string[] = [];

  for (const [shopCode, data] of allData) {
    const periodData = getMetricsForPeriod(data, startDate, endDate);
    const totalSpend = periodData.reduce((sum, day) => sum + day.spend, 0);

    if (totalSpend > 0) {
      countriesWithSpend.push(shopCode);
    }
  }

  return countriesWithSpend;
}

/**
 * Get list of countries without spend in the period
 * @param allData Map of shop code to daily metrics
 * @param startDate Period start date (YYYY-MM-DD)
 * @param endDate Period end date (YYYY-MM-DD)
 * @returns Array of shop codes with zero spend
 */
export function getCountriesWithoutSpend(
  allData: Map<string, MarketingDailyMetrics[]>,
  startDate: string,
  endDate: string
): string[] {
  const countriesWithSpend = filterCountriesWithSpend(allData, startDate, endDate);
  const allCountries = SHOPS.map(s => s.code);
  return allCountries.filter(code => !countriesWithSpend.includes(code));
}

// =============================================================================
// COUNTRY METRICS GENERATION
// =============================================================================

/**
 * Get marketing metrics for a single country
 * @param shop Shop configuration
 * @param currentData Daily metrics for current period
 * @param yoyData Daily metrics for same period last year
 * @param includeNcOrders Include NC Orders in channel metrics (monthly)
 * @returns Country marketing metrics
 */
export function getCountryMetrics(
  shop: Shop,
  currentData: MarketingDailyMetrics[],
  yoyData: MarketingDailyMetrics[],
  includeNcOrders: boolean = false
): CountryMarketingMetrics {
  const current = aggregatePeriodMetrics(currentData);
  const yoy = aggregatePeriodMetrics(yoyData);

  // Convert to NOK
  const revenueNOK = current.revenue * shop.exchangeRateToNOK;
  const yoyRevenueNOK = yoy.revenue * shop.exchangeRateToNOK;
  const spendNOK = current.spend * shop.exchangeRateToNOK;

  // Get channel metrics (only channels with spend > 0)
  const channels = getChannelMetrics(current, includeNcOrders);

  return {
    shop,
    revenue: revenueNOK,
    revenueYoY: calculateYoY(revenueNOK, yoyRevenueNOK),
    spend: spendNOK,
    mer: current.mer ?? 0,
    ncPercent: current.ncPercent ?? 0,
    orders: current.orders,
    aov: current.aov ?? 0,
    channels,
  };
}

/**
 * Get marketing metrics for all countries with spend
 * @param allData Map of shop code to daily metrics
 * @param startDate Period start date (YYYY-MM-DD)
 * @param endDate Period end date (YYYY-MM-DD)
 * @param yoyStartDate YoY period start date (YYYY-MM-DD)
 * @param yoyEndDate YoY period end date (YYYY-MM-DD)
 * @param includeNcOrders Include NC Orders in channel metrics
 * @returns Array of country metrics (sorted by revenue DESC)
 */
export function getAllCountryMetrics(
  allData: Map<string, MarketingDailyMetrics[]>,
  startDate: string,
  endDate: string,
  yoyStartDate: string,
  yoyEndDate: string,
  includeNcOrders: boolean = false
): CountryMarketingMetrics[] {
  const countriesWithSpend = filterCountriesWithSpend(allData, startDate, endDate);

  const metrics: CountryMarketingMetrics[] = [];

  for (const shopCode of countriesWithSpend) {
    const shop = SHOPS.find(s => s.code === shopCode);
    if (!shop) continue;

    const data = allData.get(shopCode);
    if (!data) continue;

    const currentData = getMetricsForPeriod(data, startDate, endDate);
    const yoyData = getMetricsForPeriod(data, yoyStartDate, yoyEndDate);

    metrics.push(getCountryMetrics(shop, currentData, yoyData, includeNcOrders));
  }

  // Sort by revenue descending
  metrics.sort((a, b) => b.revenue - a.revenue);

  return metrics;
}
