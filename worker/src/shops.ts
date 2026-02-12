export interface Shop {
  code: string;
  name: string;
  domain: string;
  currency: string;
  flag: string;
  exchangeRateToNOK: number; // Multiplier to convert to NOK
  vatRate: number; // VAT rate as decimal (0.25 = 25%). Revenue divided by (1 + vatRate)
}

// Exchange rates to NOK (approximate, update as needed)
// VAT rates: NO/SE/DK 25%, FI 25.5%, DE 19%, NL 21%, UK 20%, COM 25% (Nordic default)
export const SHOPS: Shop[] = [
  { code: 'NO', name: 'Norway', domain: 'julegenserbutikken.myshopify.com', currency: 'NOK', flag: '🇳🇴', exchangeRateToNOK: 1.00, vatRate: 0.25 },
  { code: 'SE', name: 'Sweden', domain: 'jultrojbutiken-se.myshopify.com', currency: 'SEK', flag: '🇸🇪', exchangeRateToNOK: 1.02, vatRate: 0.25 },
  { code: 'DK', name: 'Denmark', domain: 'julesweaterbutikken.myshopify.com', currency: 'DKK', flag: '🇩🇰', exchangeRateToNOK: 1.60, vatRate: 0.25 },
  { code: 'FI', name: 'Finland', domain: 'jouluneulekauppa.myshopify.com', currency: 'EUR', flag: '🇫🇮', exchangeRateToNOK: 11.80, vatRate: 0.255 },
  { code: 'DE', name: 'Germany', domain: 'jollyweihnachtspullover.myshopify.com', currency: 'EUR', flag: '🇩🇪', exchangeRateToNOK: 11.80, vatRate: 0.19 },
  { code: 'NL', name: 'Netherlands', domain: 'sillysanta-nl.myshopify.com', currency: 'EUR', flag: '🇳🇱', exchangeRateToNOK: 11.80, vatRate: 0.21 },
  { code: 'UK', name: 'UK', domain: 'sillysanta-uk.myshopify.com', currency: 'GBP', flag: '🇬🇧', exchangeRateToNOK: 14.00, vatRate: 0.20 },
  { code: 'COM', name: 'Europe', domain: 'sillysanta.myshopify.com', currency: 'USD', flag: '🇪🇺', exchangeRateToNOK: 11.00, vatRate: 0.25 },
];

export function getShopByCode(code: string): Shop | undefined {
  return SHOPS.find(s => s.code === code);
}
