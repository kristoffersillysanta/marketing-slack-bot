import { Shop } from './shops';

// =============================================================================
// CHANNEL METRICS
// =============================================================================

export type Channel = 'Meta' | 'Google' | 'TikTok';

export interface ChannelMetrics {
  channel: Channel;
  spend: number;
  pixelROAS: number | null;    // null if spend = 0
  channelROAS: number | null;  // null if spend = 0
  ncROAS: number | null;       // null if spend = 0
  ncOrders?: number;           // Only included in monthly reports
}

// =============================================================================
// COUNTRY METRICS
// =============================================================================

export interface CountryMarketingMetrics {
  shop: Shop;
  revenue: number;              // NOK, ex-VAT
  revenueYoY: number | null;    // Previous year revenue (NOK), for YoY calc
  spend: number;                // NOK
  roas: number;                 // revenue / spend (overall)
  ncRoas: number;               // nc_revenue / spend (overall)
  ncPercent: number;            // new_customer_orders / orders × 100
  orders: number;
  aov: number;                  // revenue / orders
  channels: ChannelMetrics[];   // Only channels with spend > 0
}

// =============================================================================
// AGGREGATED PERIOD METRICS
// =============================================================================

export interface PeriodMarketingMetrics {
  // Totals
  revenue: number;
  spend: number;
  orders: number;
  newCustomerOrders: number;

  // Calculated metrics
  mer: number | null;           // revenue / spend
  ncPercent: number | null;     // newCustomerOrders / orders × 100
  aov: number | null;           // revenue / orders

  // Channel totals (for weighted ROAS calculations)
  metaSpend: number;
  metaPixelRevenue: number;
  metaChannelRevenue: number;
  metaPixelNcRevenue: number;

  googleSpend: number;
  googlePixelRevenue: number;
  googleChannelRevenue: number;
  googlePixelNcRevenue: number;

  tiktokSpend: number;
  tiktokPixelRevenue: number;
  tiktokChannelRevenue: number;
  tiktokPixelNcRevenue: number;

  // Meta info
  daysWithData: number;
}

// =============================================================================
// REPORT DATA STRUCTURES
// =============================================================================

export interface TrendData {
  period: string;               // e.g., "Week 4" or "January"
  revenue: number;
  spend: number;
  roas: number;
  ncRoas: number;
  ncPercent: number;
  vsLY: number | null;
}

export interface PacingData {
  label: string;                // e.g., "Mon–Wed" or "Feb 1–9"
  countries: CountryMarketingMetrics[];
  totals: {
    revenue: number;
    spend: number;
    roas: number;
    ncRoas: number;
    ncPercent: number;
    orders: number;
    aov: number;
    vsLY: number | null;
  };
}

export interface DailyReportData {
  date: Date;
  countries: CountryMarketingMetrics[];
  totals: {
    revenue: number;
    spend: number;
    roas: number;
    ncRoas: number;
    ncPercent: number;
    orders: number;
    aov: number;
    vsLY: number | null;
  };
  noSpendCountries: string[];   // Country codes with zero spend
  wtd?: PacingData;             // Week-to-date (Wed-Fri only)
}

export interface WeeklyReportData {
  weekNumber: number;
  year: number;
  startDate: Date;
  endDate: Date;
  countries: CountryMarketingMetrics[];
  totals: {
    revenue: number;
    spend: number;
    roas: number;
    ncRoas: number;
    ncPercent: number;
    orders: number;
    aov: number;
    vsLY: number | null;
  };
  trend: TrendData[];           // Last 3 weeks
  noSpendCountries: string[];
  pixelDataIncomplete: boolean; // True if endDate is within 3 days
  mtd?: PacingData;             // Month-to-date (2nd+ week of month)
}

export interface MonthlyReportData {
  month: number;                // 1-12
  year: number;
  countries: CountryMarketingMetrics[];
  totals: {
    revenue: number;
    spend: number;
    roas: number;
    ncRoas: number;
    ncPercent: number;
    orders: number;
    aov: number;
    vsLY: number | null;
  };
  trend: TrendData[];           // Last 3 months
  noSpendCountries: string[];
}
