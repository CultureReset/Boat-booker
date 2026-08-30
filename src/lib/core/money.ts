import { currencyByCode, defaultCurrency, type Currency } from '@/config/locale';

/**
 * Money helpers.
 *
 * Amounts are stored as whole units of the listing's base currency and
 * converted for display only. Every price a user sees goes through
 * `formatMoney`, so changing currency presentation is a change here alone.
 */

export interface Money {
  value: number;
  currency: string;
  displayValue: string;
}

export function resolveCurrency(code?: string): Currency {
  return currencyByCode.get((code ?? defaultCurrency).toUpperCase()) ?? currencyByCode.get(defaultCurrency)!;
}

/** Convert between two registered currencies via their USD rates. */
export function convert(amount: number, from: string, to: string): number {
  if (from.toUpperCase() === to.toUpperCase()) return amount;
  const source = resolveCurrency(from);
  const target = resolveCurrency(to);
  return (amount / source.rate) * target.rate;
}

export function formatMoney(amount: number, code = defaultCurrency): string {
  const currency = resolveCurrency(code);
  const rounded = currency.decimals === 0 ? Math.round(amount) : amount;
  const digits = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(rounded);
  return currency.position === 'prefix'
    ? `${currency.symbol}${currency.symbol.endsWith('$') ? '' : ' '}${digits}`.replace('$ ', '$')
    : `${digits} ${currency.symbol}`;
}

/** Build the `{ value, currency, displayValue }` shape the API returns. */
export function money(amount: number, from: string, to = from): Money {
  const converted = convert(amount, from, to);
  const currency = resolveCurrency(to);
  const value = currency.decimals === 0 ? Math.round(converted) : Number(converted.toFixed(currency.decimals));
  return { value, currency: currency.code, displayValue: formatMoney(value, currency.code) };
}

/** Round to the currency's smallest displayed unit, avoiding float drift. */
export function roundMoney(amount: number, code = defaultCurrency): number {
  const currency = resolveCurrency(code);
  const factor = 10 ** currency.decimals;
  return Math.round(amount * factor) / factor;
}
