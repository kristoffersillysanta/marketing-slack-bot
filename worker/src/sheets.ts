// Single Google Sheet with all countries (one tab per country code)
const SHEET_ID = '1IGS1GS7f0pSyOrpk1qEGL_dKdlmpm2G7_pO__Re-0TU';

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

// Create JWT for Google API authentication
async function createJWT(credentials: ServiceAccountCredentials): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 hour
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Sign with RSA-SHA256
  const signature = await signWithRS256(signatureInput, credentials.private_key);

  return `${signatureInput}.${signature}`;
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signWithRS256(data: string, privateKeyPem: string): Promise<string> {
  // Parse PEM format
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(data)
  );

  return arrayBufferToBase64Url(signature);
}

// Exchange JWT for access token
async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const jwt = await createJWT(credentials);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

// Helper to format date for comparison
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// =============================================================================
// DATA TYPES
// =============================================================================

export interface MarketingDailyMetrics {
  date: string; // YYYY-MM-DD
  orderRevenue: number;  // gross sales (always positive, VAT-inclusive in sheet)
  spend: number;         // total ad spend (sum of all channels)
  orders: number;        // total orders
  newCustomerOrders: number;  // new customer orders

  // Meta channel
  metaSpend: number;
  metaPixelRevenue: number;
  metaChannelRevenue: number;
  metaPixelNcRevenue: number;  // new customer revenue

  // Google channel
  googleSpend: number;
  googlePixelRevenue: number;
  googleChannelRevenue: number;
  googlePixelNcRevenue: number;

  // TikTok channel
  tiktokSpend: number;
  tiktokPixelRevenue: number;
  tiktokChannelRevenue: number;
  tiktokPixelNcRevenue: number;
}

// =============================================================================
// DATA LOADING (one API call per shop)
// =============================================================================

// Read ALL metrics from a shop tab (no date filtering — load once, filter locally)
async function readAllShopMetrics(
  accessToken: string,
  shopCode: string
): Promise<MarketingDailyMetrics[]> {
  const range = encodeURIComponent(`'${shopCode}'!A:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ FAILED to read sheet for ${shopCode}: ${response.status} ${error}`);
    throw new Error(`Failed to read sheet ${shopCode}: ${response.status}`);
  }

  const data = await response.json() as { values?: string[][] };
  const rows = data.values || [];

  if (rows.length < 2) {
    console.log(`Sheet ${shopCode} has no data`);
    return [];
  }

  const headers = rows[0].map(h => h?.toLowerCase().trim() || '');

  // Base columns
  const dateCol = headers.findIndex(h => h === 'date');
  const orderRevCol = headers.findIndex(h => h === 'order_revenue');
  const spendCol = headers.findIndex(h => h === 'spend');
  const ordersCol = headers.findIndex(h => h === 'orders');
  const newCustomerOrdersCol = headers.findIndex(h => h === 'new_customer_orders');

  // Meta columns
  const metaSpendCol = headers.findIndex(h => h === 'meta_spend');
  const metaPixelRevCol = headers.findIndex(h => h === 'meta_pixel_revenue');
  const metaChannelRevCol = headers.findIndex(h => h === 'meta_channel_revenue');
  const metaPixelNcRevCol = headers.findIndex(h => h === 'meta_pixel_nc_revenue');

  // Google columns
  const googleSpendCol = headers.findIndex(h => h === 'google_spend');
  const googlePixelRevCol = headers.findIndex(h => h === 'google_pixel_revenue');
  const googleChannelRevCol = headers.findIndex(h => h === 'google_channel_revenue');
  const googlePixelNcRevCol = headers.findIndex(h => h === 'google_pixel_nc_revenue');

  // TikTok columns
  const tiktokSpendCol = headers.findIndex(h => h === 'tiktok_spend');
  const tiktokPixelRevCol = headers.findIndex(h => h === 'tiktok_pixel_revenue');
  const tiktokChannelRevCol = headers.findIndex(h => h === 'tiktok_channel_revenue');
  const tiktokPixelNcRevCol = headers.findIndex(h => h === 'tiktok_pixel_nc_revenue');

  if (dateCol === -1 || orderRevCol === -1) {
    console.error(`Could not find required columns for ${shopCode}. Headers: ${headers.join(', ')}`);
    return [];
  }

  const results: MarketingDailyMetrics[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[dateCol]) continue;

    // ISO format: 2025-02-06
    const rowDate = new Date(row[dateCol] + 'T00:00:00');
    if (isNaN(rowDate.getTime())) continue;

    const orderRevenue = parseFloat(row[orderRevCol]) || 0;
    const spend = spendCol >= 0 ? (parseFloat(row[spendCol]) || 0) : 0;
    const orders = ordersCol >= 0 ? (parseFloat(row[ordersCol]) || 0) : 0;
    const newCustomerOrders = newCustomerOrdersCol >= 0 ? (parseFloat(row[newCustomerOrdersCol]) || 0) : 0;

    // Meta
    const metaSpend = metaSpendCol >= 0 ? (parseFloat(row[metaSpendCol]) || 0) : 0;
    const metaPixelRevenue = metaPixelRevCol >= 0 ? (parseFloat(row[metaPixelRevCol]) || 0) : 0;
    const metaChannelRevenue = metaChannelRevCol >= 0 ? (parseFloat(row[metaChannelRevCol]) || 0) : 0;
    const metaPixelNcRevenue = metaPixelNcRevCol >= 0 ? (parseFloat(row[metaPixelNcRevCol]) || 0) : 0;

    // Google
    const googleSpend = googleSpendCol >= 0 ? (parseFloat(row[googleSpendCol]) || 0) : 0;
    const googlePixelRevenue = googlePixelRevCol >= 0 ? (parseFloat(row[googlePixelRevCol]) || 0) : 0;
    const googleChannelRevenue = googleChannelRevCol >= 0 ? (parseFloat(row[googleChannelRevCol]) || 0) : 0;
    const googlePixelNcRevenue = googlePixelNcRevCol >= 0 ? (parseFloat(row[googlePixelNcRevCol]) || 0) : 0;

    // TikTok
    const tiktokSpend = tiktokSpendCol >= 0 ? (parseFloat(row[tiktokSpendCol]) || 0) : 0;
    const tiktokPixelRevenue = tiktokPixelRevCol >= 0 ? (parseFloat(row[tiktokPixelRevCol]) || 0) : 0;
    const tiktokChannelRevenue = tiktokChannelRevCol >= 0 ? (parseFloat(row[tiktokChannelRevCol]) || 0) : 0;
    const tiktokPixelNcRevenue = tiktokPixelNcRevCol >= 0 ? (parseFloat(row[tiktokPixelNcRevCol]) || 0) : 0;

    results.push({
      date: formatLocalDate(rowDate),
      orderRevenue,
      spend,
      orders,
      newCustomerOrders,
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
    });
  }

  return results;
}

// Load all shop data in parallel (1 auth call + 8 API calls total)
export async function loadAllShopData(
  credentials: ServiceAccountCredentials,
  shopCodes: string[]
): Promise<Map<string, MarketingDailyMetrics[]>> {
  const accessToken = await getAccessToken(credentials);

  console.log(`Loading marketing data for ${shopCodes.length} shops...`);
  const results = await Promise.all(
    shopCodes.map(code => readAllShopMetrics(accessToken, code))
  );

  const dataMap = new Map<string, MarketingDailyMetrics[]>();
  shopCodes.forEach((code, i) => {
    console.log(`  ${code}: ${results[i].length} days loaded`);
    dataMap.set(code, results[i]);
  });

  return dataMap;
}

// =============================================================================
// LOCAL FILTERING (no API calls)
// =============================================================================

export function getMetricsForPeriod(
  allData: MarketingDailyMetrics[],
  startDate: string,
  endDate: string
): MarketingDailyMetrics[] {
  return allData.filter(m => m.date >= startDate && m.date <= endDate);
}
