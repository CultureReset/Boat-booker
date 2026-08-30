import { brand } from '@/config/brand';
import { catalog, type Domain } from './catalog';

/**
 * Placeholder + pluralisation engine.
 *
 * Two syntaxes, both taken from the shape the production catalog uses:
 *
 *  - Placeholders: `"Rated %score% by %count% guests"` with
 *    `{ score: 4.8, count: 12 }`. `%brand%` and `%year%` are always available.
 *  - Plural forms: `"{0}No boats|{1}%p% boat|[2,Inf]%p% boats"` selected by the
 *    `count` value. `%p%` is shorthand for that count.
 *
 * Unknown keys return the key itself rather than throwing, so a missing string
 * is a visible bug in development without taking a page down in production.
 */

export type TranslateValues = Record<string, string | number | undefined | null>;

const PLURAL_EXACT = /^\{(\d+)\}/;
const PLURAL_RANGE = /^\[(\d+),(\d+|Inf)\]/;

function selectPluralForm(template: string, count: number): string {
  if (!template.includes('|') && !PLURAL_EXACT.test(template)) return template;

  const forms = template.split('|');
  let fallback: string | null = null;

  for (const rawForm of forms) {
    const form = rawForm.trim();

    const exact = form.match(PLURAL_EXACT);
    if (exact) {
      if (Number(exact[1]) === count) return form.slice(exact[0].length).trim();
      continue;
    }

    const range = form.match(PLURAL_RANGE);
    if (range) {
      const min = Number(range[1]);
      const max = range[2] === 'Inf' ? Number.POSITIVE_INFINITY : Number(range[2]);
      if (count >= min && count <= max) return form.slice(range[0].length).trim();
      continue;
    }

    // A form with no selector acts as the catch-all.
    fallback ??= form;
  }

  return fallback ?? forms[forms.length - 1].trim();
}

function interpolate(template: string, values: TranslateValues): string {
  const merged: TranslateValues = {
    brand: brand.name,
    brandLegal: brand.legalName,
    year: new Date().getFullYear(),
    phone: brand.supportPhone,
    ...values,
  };

  // `%p%` is the conventional shorthand for the pluralising count.
  if (merged.count !== undefined && merged.p === undefined) merged.p = merged.count;

  return template.replace(/%([a-zA-Z0-9_]+)%/g, (match, key: string) => {
    const value = merged[key];
    return value === undefined || value === null ? match : String(value);
  });
}

/** Resolve a `domain.key` string with the given values. */
export function translate(
  domain: Domain,
  key: string,
  values: TranslateValues = {},
): string {
  const bundle = catalog[domain] as Record<string, string> | undefined;
  const template = bundle?.[key];

  if (typeof template !== 'string') {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[i18n] missing string: ${domain}.${key}`);
    }
    return `${domain}.${key}`;
  }

  const count = typeof values.count === 'number' ? values.count : undefined;
  const selected = count === undefined ? template : selectPluralForm(template, count);
  return interpolate(selected, values);
}

/**
 * Build a translator bound to one domain. Components take this as `t` so a
 * component never names its domain more than once.
 */
export function translatorFor<D extends Domain>(domain: D) {
  return (key: keyof (typeof catalog)[D] & string, values?: TranslateValues) =>
    translate(domain, key, values);
}

export type Translator = ReturnType<typeof translatorFor>;

/**
 * Some strings intentionally carry inline markup (links, `<strong>`). This
 * whitelists the tags we allow through `dangerouslySetInnerHTML` so a catalog
 * string can never inject script or event handlers.
 */
const ALLOWED_TAG = /^<\/?(b|strong|em|i|br|a)(\s[^<>]*)?>$/i;
const SAFE_HREF = /^(\/|https?:\/\/|tel:|mailto:)/i;

export function sanitizeRichText(input: string): string {
  return input.replace(/<[^>]*>/g, (tag) => {
    if (!ALLOWED_TAG.test(tag)) return '';
    // Strip every attribute except a safe href on anchors.
    if (/^<a\b/i.test(tag)) {
      const href = tag.match(/href\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
      return SAFE_HREF.test(href) ? `<a href="${href.replace(/"/g, '&quot;')}">` : '<a>';
    }
    return tag.replace(/\s+[a-zA-Z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g, '');
  });
}
