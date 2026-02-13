import { MarketingDailyMetrics } from './sheets';
import { PeriodMarketingMetrics, Channel, ChannelMetrics } from './types';

// =============================================================================
// PERIOD AGGREGATION
// =============================================================================

/**
 * Aggregate daily metrics into period totals
 * @param dailyMetrics Array of daily metrics for the period
 * @returns Aggregated metrics with totals and calculated percentages
 */
export function aggregatePeriodMetrics(dailyMetrics: MarketingDailyMetrics[]): PeriodMarketingMetrics {
  if (dailyMetrics.length === 0) {
    return {
      revenue: 0,
      spend: 0,
      orders: 0,
      newCustomerOrders: 0,
      mer: null,
      ncPercent: null,
      aov: null,
      metaSpend: 0,
      metaPixelRevenue: 0,
      metaChannelRevenue: 0,
      metaPixelNcRevenue: 0,
      googleSpend: 0,
      googlePixelRevenue: 0,
      googleChannelRevenue: 0,
      googlePixelNcRevenue: 0,
      tiktokSpend: 0,
      tiktokPixelRevenue: 0,
      tiktokChannelRevenue: 0,
      tiktokPixelNcRevenue: 0,
      daysWithData: 0,
    };
  }

  let revenue = 0;
  let spend = 0;
  let orders = 0;
  let newCustomerOrders = 0;

  let metaSpend = 0;
  let metaPixelRevenue = 0;
  let metaChannelRevenue = 0;
  let metaPixelNcRevenue = 0;

  let googleSpend = 0;
  let googlePixelRevenue = 0;
  let googleChannelRevenue = 0;
  let googlePixelNcRevenue = 0;

  let tiktokSpend = 0;
  let tiktokPixelRevenue = 0;
  let tiktokChannelRevenue = 0;
  let tiktokPixelNcRevenue = 0;

  for (const day of dailyMetrics) {
    revenue += day.orderRevenue;
    spend += day.spend;
    orders += day.orders;
    newCustomerOrders += day.newCustomerOrders;

    metaSpend += day.metaSpend;
    metaPixelRevenue += day.metaPixelRevenue;
    metaChannelRevenue += day.metaChannelRevenue;
    metaPixelNcRevenue += day.metaPixelNcRevenue;

    googleSpend += day.googleSpend;
    googlePixelRevenue += day.googlePixelRevenue;
    googleChannelRevenue += day.googleChannelRevenue;
    googlePixelNcRevenue += day.googlePixelNcRevenue;

    tiktokSpend += day.tiktokSpend;
    tiktokPixelRevenue += day.tiktokPixelRevenue;
    tiktokChannelRevenue += day.tiktokChannelRevenue;
    tiktokPixelNcRevenue += day.tiktokPixelNcRevenue;
  }

  return {
    revenue,
    spend,
    orders,
    newCustomerOrders,
    mer: revenue > 0 ? (spend / revenue) * 100 : null,
    ncPercent: orders > 0 ? (newCustomerOrders / orders) * 100 : null,
    aov: orders > 0 ? revenue / orders : null,
    metaSpend,
    metaPixelRevenue,
    metaChannelRevenue,
    metaPixelNcRevenue,
    googleSpend,
    googlePixelRevenue,
    googleChannelRevenue,
    googlePixelNcRevenue,
    tiktokSpend,
    tiktokPixelRevenue,
    tiktokChannelRevenue,
    tiktokPixelNcRevenue,
    daysWithData: dailyMetrics.length,
  };
}

// =============================================================================
// CHANNEL ROAS CALCULATIONS
// =============================================================================

/**
 * Calculate all three ROAS types for a channel
 * @param spend Channel ad spend
 * @param pixelRevenue Pixel-tracked revenue
 * @param channelRevenue Platform-reported revenue
 * @param ncRevenue New customer revenue (pixel-tracked)
 * @returns ROAS metrics (null if spend = 0)
 */
export function calculateChannelROAS(
  spend: number,
  pixelRevenue: number,
  channelRevenue: number,
  ncRevenue: number
): { pixelROAS: number | null; channelROAS: number | null; ncROAS: number | null } {
  if (spend <= 0) {
    return { pixelROAS: null, channelROAS: null, ncROAS: null };
  }

  return {
    pixelROAS: pixelRevenue / spend,
    channelROAS: channelRevenue / spend,
    ncROAS: ncRevenue / spend,
  };
}

/**
 * Get channel metrics for a period
 * @param metrics Aggregated period metrics
 * @param includeNcOrders Include NC Orders in result (for monthly reports)
 * @returns Array of channel metrics (only channels with spend > 0)
 */
export function getChannelMetrics(
  metrics: PeriodMarketingMetrics,
  includeNcOrders: boolean = false
): ChannelMetrics[] {
  const channels: ChannelMetrics[] = [];

  // Meta
  if (metrics.metaSpend > 0) {
    const roas = calculateChannelROAS(
      metrics.metaSpend,
      metrics.metaPixelRevenue,
      metrics.metaChannelRevenue,
      metrics.metaPixelNcRevenue
    );
    channels.push({
      channel: 'Meta',
      spend: metrics.metaSpend,
      pixelROAS: roas.pixelROAS,
      channelROAS: roas.channelROAS,
      ncROAS: roas.ncROAS,
      ...(includeNcOrders && { ncOrders: 0 }), // TODO: Calculate from NC revenue / AOV
    });
  }

  // Google
  if (metrics.googleSpend > 0) {
    const roas = calculateChannelROAS(
      metrics.googleSpend,
      metrics.googlePixelRevenue,
      metrics.googleChannelRevenue,
      metrics.googlePixelNcRevenue
    );
    channels.push({
      channel: 'Google',
      spend: metrics.googleSpend,
      pixelROAS: roas.pixelROAS,
      channelROAS: roas.channelROAS,
      ncROAS: roas.ncROAS,
      ...(includeNcOrders && { ncOrders: 0 }),
    });
  }

  // TikTok
  if (metrics.tiktokSpend > 0) {
    const roas = calculateChannelROAS(
      metrics.tiktokSpend,
      metrics.tiktokPixelRevenue,
      metrics.tiktokChannelRevenue,
      metrics.tiktokPixelNcRevenue
    );
    channels.push({
      channel: 'TikTok',
      spend: metrics.tiktokSpend,
      pixelROAS: roas.pixelROAS,
      channelROAS: roas.channelROAS,
      ncROAS: roas.ncROAS,
      ...(includeNcOrders && { ncOrders: 0 }),
    });
  }

  return channels;
}

// =============================================================================
// WEIGHTED AGGREGATION (multi-country totals)
// =============================================================================

/**
 * Calculate weighted totals across multiple countries
 * Weights ROAS, NC ROAS, NC%, and AOV by revenue
 * @param countries Array of country metrics
 * @returns Weighted totals
 */
export function calculateWeightedTotals(
  countries: Array<{
    revenue: number;
    spend: number;
    roas: number;
    ncRoas: number;
    ncPercent: number;
    orders: number;
    aov: number;
  }>
): {
  totalRevenue: number;
  totalSpend: number;
  weightedROAS: number;
  weightedNCROAS: number;
  weightedNCPercent: number;
  weightedAOV: number;
  totalOrders: number;
} {
  let totalRevenue = 0;
  let totalSpend = 0;
  let totalOrders = 0;

  for (const country of countries) {
    totalRevenue += country.revenue;
    totalSpend += country.spend;
    totalOrders += country.orders;
  }

  // Weight by revenue
  let weightedROASSum = 0;
  let weightedNCROASSum = 0;
  let weightedNCPercentSum = 0;
  let weightedAOVSum = 0;

  for (const country of countries) {
    const weight = totalRevenue > 0 ? country.revenue / totalRevenue : 0;
    weightedROASSum += country.roas * weight;
    weightedNCROASSum += country.ncRoas * weight;
    weightedNCPercentSum += country.ncPercent * weight;
    weightedAOVSum += country.aov * weight;
  }

  return {
    totalRevenue,
    totalSpend,
    weightedROAS: weightedROASSum,
    weightedNCROAS: weightedNCROASSum,
    weightedNCPercent: weightedNCPercentSum,
    weightedAOV: weightedAOVSum,
    totalOrders,
  };
}

// =============================================================================
// YOY COMPARISON
// =============================================================================

/**
 * Calculate year-over-year percentage change
 * @param current Current period value
 * @param previous Previous period value (same period last year)
 * @returns Percentage change or null if previous ≤ 0
 */
export function calculateYoY(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current / previous) - 1) * 100;
}

// =============================================================================
// PIXEL DATA COMPLETENESS CHECK
// =============================================================================

/**
 * Check if pixel data is likely incomplete (within 3 days of period end)
 * @param endDate Period end date (YYYY-MM-DD)
 * @returns True if pixel data may be incomplete
 */
export function isPixelDataIncomplete(endDate: string): boolean {
  const end = new Date(endDate + 'T00:00:00');
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff <= 3 && daysDiff >= 0;
}
