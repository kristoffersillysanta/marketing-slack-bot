import type { Env, MCPToolDefinition, MCPResponse } from '../types';
import { SHOPS } from '../shops';
import { loadAllShopData, getMetricsForPeriod, ServiceAccountCredentials } from '../sheets';

const ALL_SHOP_CODES = ['NO', 'SE', 'DK', 'FI', 'UK', 'DE', 'NL', 'COM'];

export const MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: 'get_marketing_data',
    description:
      'Get daily marketing data from Google Sheets for SillySanta stores. Returns raw daily rows with revenue, spend, orders, and per-channel (Meta, Google, TikTok) breakdowns. Data available from 2024-02-01 (UK from 2024-09-01). Use this to analyze ROAS, compare periods (e.g. Black Friday YoY), track trends, etc. Max 400 days per request.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (inclusive)',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (inclusive)',
        },
        shops: {
          type: 'array',
          items: {
            type: 'string',
            enum: ALL_SHOP_CODES,
          },
          description: 'Country codes to include. Default: all 8 (NO, SE, DK, FI, UK, DE, NL, COM)',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
];

export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  env: Env
): Promise<MCPResponse> {
  switch (toolName) {
    case 'get_marketing_data':
      return await handleGetMarketingData(args, env);
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
  }
}

async function handleGetMarketingData(
  args: Record<string, unknown>,
  env: Env
): Promise<MCPResponse> {
  const startDate = args.start_date as string;
  const endDate = args.end_date as string;
  const shops = (args.shops as string[] | undefined) ?? ALL_SHOP_CODES;

  // Validate dates
  if (!startDate || !endDate) {
    return {
      content: [{ type: 'text', text: 'Error: start_date and end_date are required (YYYY-MM-DD).' }],
      isError: true,
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return {
      content: [{ type: 'text', text: 'Error: dates must be YYYY-MM-DD format.' }],
      isError: true,
    };
  }

  if (startDate > endDate) {
    return {
      content: [{ type: 'text', text: 'Error: start_date must be before or equal to end_date.' }],
      isError: true,
    };
  }

  // Guard against huge date ranges
  const daySpan = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
  if (daySpan > 400) {
    return {
      content: [{ type: 'text', text: 'Error: max 400 days per request. Narrow the date range or make multiple requests.' }],
      isError: true,
    };
  }

  // Validate shop codes
  const invalidShops = shops.filter(s => !ALL_SHOP_CODES.includes(s));
  if (invalidShops.length > 0) {
    return {
      content: [{ type: 'text', text: `Error: invalid shop codes: ${invalidShops.join(', ')}. Valid: ${ALL_SHOP_CODES.join(', ')}` }],
      isError: true,
    };
  }

  try {
    // Load data from Google Sheets
    const creds: ServiceAccountCredentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
    const allData = await loadAllShopData(creds, shops);

    // Build response
    const shopMetadata: Record<string, object> = {};
    const dataByShop: Record<string, object[]> = {};
    let totalRows = 0;

    for (const shopCode of shops) {
      const shop = SHOPS.find(s => s.code === shopCode);
      if (!shop) continue;

      const shopData = allData.get(shopCode) ?? [];
      const periodData = getMetricsForPeriod(shopData, startDate, endDate);

      shopMetadata[shopCode] = {
        name: shop.name,
        currency: shop.currency,
        exchange_rate_to_nok: shop.exchangeRateToNOK,
        vat_rate: shop.vatRate,
      };

      dataByShop[shopCode] = periodData.map(day => ({
        date: day.date,
        order_revenue: day.orderRevenue,
        spend: day.spend,
        orders: day.orders,
        new_customer_orders: day.newCustomerOrders,
        meta_spend: day.metaSpend,
        meta_pixel_revenue: day.metaPixelRevenue,
        meta_channel_revenue: day.metaChannelRevenue,
        meta_pixel_nc_revenue: day.metaPixelNcRevenue,
        google_spend: day.googleSpend,
        google_pixel_revenue: day.googlePixelRevenue,
        google_channel_revenue: day.googleChannelRevenue,
        google_pixel_nc_revenue: day.googlePixelNcRevenue,
        tiktok_spend: day.tiktokSpend,
        tiktok_pixel_revenue: day.tiktokPixelRevenue,
        tiktok_channel_revenue: day.tiktokChannelRevenue,
        tiktok_pixel_nc_revenue: day.tiktokPixelNcRevenue,
      }));

      totalRows += dataByShop[shopCode].length;
    }

    const response = {
      query: { start_date: startDate, end_date: endDate, shops },
      shops: shopMetadata,
      data: dataByShop,
      notes: [
        'Revenue figures are VAT-inclusive (gross). Divide by (1 + vat_rate) for ex-VAT revenue.',
        'Spend is always ex-VAT.',
        'All values are in each shop\'s local currency. Use exchange_rate_to_nok to convert to NOK.',
        'UK data available from 2024-09-01. COM data sparse before 2024-06-01.',
        'Pixel data may be incomplete for the most recent 1-3 days.',
        'Key formulas: ROAS = revenue/spend, Pixel ROAS = channel_pixel_revenue/channel_spend, Channel ROAS = channel_channel_revenue/channel_spend, NC ROAS = channel_pixel_nc_revenue/channel_spend, NC% = new_customer_orders/orders*100, AOV = revenue/orders, MER = revenue/total_spend',
      ],
      rows_returned: totalRows,
      date_range_days: daySpan,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error fetching data: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}
