/**
 * Currency and language registries. Prices are stored once in the listing's
 * base currency and converted at read time, so switching the display currency
 * never mutates stored data.
 */

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  /** Rate relative to USD. Replaced by a live FX feed in production. */
  rate: number;
  /** Symbol placement, used by the formatter. */
  position: 'prefix' | 'suffix';
  decimals: number;
}

export const currencies: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: 'US $', rate: 1, position: 'prefix', decimals: 0 },
  { code: 'AED', name: 'UAE Dirhams', symbol: 'AED', rate: 3.67, position: 'suffix', decimals: 0 },
  { code: 'ARS', name: 'Argentine Peso', symbol: 'ARS', rate: 1010, position: 'suffix', decimals: 0 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'AU $', rate: 1.52, position: 'prefix', decimals: 0 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'BRL', rate: 5.8, position: 'suffix', decimals: 0 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA $', rate: 1.39, position: 'prefix', decimals: 0 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', rate: 0.88, position: 'suffix', decimals: 0 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: 'CNY', rate: 7.25, position: 'suffix', decimals: 0 },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'CZK', rate: 23.8, position: 'suffix', decimals: 0 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'DKK', rate: 7.05, position: 'suffix', decimals: 0 },
  { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.94, position: 'prefix', decimals: 0 },
  { code: 'FJD', name: 'Fijian Dollar', symbol: 'FJ $', rate: 2.27, position: 'prefix', decimals: 0 },
  { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.79, position: 'prefix', decimals: 0 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK $', rate: 7.78, position: 'prefix', decimals: 0 },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'HUF', rate: 385, position: 'suffix', decimals: 0 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'IDR', rate: 15800, position: 'suffix', decimals: 0 },
  { code: 'ILS', name: 'Israeli New Sheqel', symbol: 'ILS', rate: 3.7, position: 'suffix', decimals: 0 },
  { code: 'INR', name: 'Indian Rupee', symbol: 'INR', rate: 84.2, position: 'suffix', decimals: 0 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rate: 152, position: 'prefix', decimals: 0 },
  { code: 'KRW', name: 'South Korean Won', symbol: 'KRW', rate: 1390, position: 'suffix', decimals: 0 },
  { code: 'MUR', name: 'Mauritian Rupees', symbol: 'MUR', rate: 46.5, position: 'suffix', decimals: 0 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MXN', rate: 20.1, position: 'suffix', decimals: 0 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'MYR', rate: 4.45, position: 'suffix', decimals: 0 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'NOK', rate: 11.0, position: 'suffix', decimals: 0 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ $', rate: 1.71, position: 'prefix', decimals: 0 },
  { code: 'PHP', name: 'Philippine Peso', symbol: 'PHP', rate: 58.5, position: 'suffix', decimals: 0 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'PLN', rate: 4.08, position: 'suffix', decimals: 0 },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', rate: 103, position: 'suffix', decimals: 0 },
  { code: 'SCR', name: 'Seychelles Rupee', symbol: 'SCR', rate: 14.4, position: 'suffix', decimals: 0 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'SEK', rate: 10.9, position: 'suffix', decimals: 0 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S $', rate: 1.34, position: 'prefix', decimals: 0 },
  { code: 'THB', name: 'Thai Baht', symbol: 'THB', rate: 34.4, position: 'suffix', decimals: 0 },
  { code: 'TRY', name: 'Turkish Lira', symbol: 'TRY', rate: 34.6, position: 'suffix', decimals: 0 },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT $', rate: 32.5, position: 'prefix', decimals: 0 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: 'VND', rate: 25400, position: 'suffix', decimals: 0 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'ZAR', rate: 18.1, position: 'suffix', decimals: 0 },
];

export const currencyByCode = new Map(currencies.map((c) => [c.code, c]));
export const defaultCurrency = 'USD';

export interface Language {
  code: string;
  label: string;
  englishLabel: string;
  /** URL prefix; English is served without one. */
  prefix: string;
  /** Locales not yet cleared for indexing are excluded from hreflang + sitemap. */
  indexable: boolean;
}

export const languages: Language[] = [
  { code: 'en', label: 'English (US)', englishLabel: 'English', prefix: '', indexable: true },
  { code: 'de', label: 'Deutsch', englishLabel: 'German', prefix: '/de', indexable: false },
  { code: 'es', label: 'Español', englishLabel: 'Spanish', prefix: '/es', indexable: false },
  { code: 'fr', label: 'Français', englishLabel: 'French', prefix: '/fr', indexable: false },
];

export const languageByCode = new Map(languages.map((l) => [l.code, l]));
export const defaultLanguage = 'en';

/** Distance units follow the viewer's country rather than the listing's. */
export const unitSystems = {
  imperial: { length: 'ft', distance: 'mi', distanceFactor: 0.621371 },
  metric: { length: 'm', distance: 'km', distanceFactor: 1 },
} as const;

export type UnitSystem = keyof typeof unitSystems;

const imperialCountries = new Set(['us', 'lr', 'mm']);

export function unitSystemFor(countryCode: string): UnitSystem {
  return imperialCountries.has(countryCode.toLowerCase()) ? 'imperial' : 'metric';
}
