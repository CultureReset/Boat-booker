/**
 * Seasonal deal campaigns.
 *
 * Data, not code: a campaign is a slug, some copy, a window it runs in and a
 * rule for which listings belong on it. Adding next year's Thanksgiving page is
 * an entry here, not a new route — `/deals/[[...slug]]` renders whatever is in
 * this list.
 *
 * `window` is month-and-day rather than a full date so a campaign repeats every
 * year without being re-dated. A window whose end is before its start wraps the
 * new year, which is how the holiday campaign runs.
 */

/**
 * What puts a listing on a campaign.
 *
 * Every rule is computable from the listing itself — there is no promo table
 * behind these pages, and inventing a discount field the booking engine would
 * not honour would put a number on a card that checkout then disagreed with.
 * `best_rate` is measured against the median of the set being shown, so the
 * claim is true of whatever inventory happens to be live.
 */
export type CampaignFilter =
  | { kind: 'best_rate'; percentBelowMedian: number }
  | { kind: 'free_cancellation'; minDays: number }
  | { kind: 'award' }
  | { kind: 'instant_book' };

export interface Campaign {
  slug: string;
  title: string;
  subtitle: string;
  /** Inclusive `MM-DD` bounds; the end may precede the start to wrap a year. */
  window: { from: string; to: string };
  /** Which listings qualify. */
  filter: CampaignFilter;
  /** Tailwind gradient for the hero, so a campaign reads as its own thing. */
  hero: string;
}

export const campaigns: Campaign[] = [
  {
    slug: 'holiday',
    title: 'Holiday on the water',
    subtitle: 'Trips running through the holidays, at the best rates on the water.',
    window: { from: '12-01', to: '01-06' },
    filter: { kind: 'best_rate', percentBelowMedian: 10 },
    hero: 'from-brand-800 to-brand-500',
  },
  {
    slug: 'thanksgiving',
    title: 'Thanksgiving week',
    subtitle: 'Get everyone out on the water while they are in town — cancel free if plans move.',
    window: { from: '11-15', to: '11-30' },
    filter: { kind: 'free_cancellation', minDays: 3 },
    hero: 'from-accent-700 to-accent-400',
  },
  {
    slug: 'boaters-choice',
    title: 'Boaters’ Choice',
    subtitle: 'The operators rated highest by the guests who travelled with them.',
    window: { from: '01-01', to: '12-31' },
    filter: { kind: 'award' },
    hero: 'from-ink to-slate-600',
  },
  {
    slug: 'book-instantly',
    title: 'Book instantly',
    subtitle: 'Confirmed the moment you book — no waiting on a reply.',
    window: { from: '01-01', to: '12-31' },
    filter: { kind: 'instant_book' },
    hero: 'from-emerald-700 to-emerald-400',
  },
];

export function campaignBySlug(slug: string): Campaign | undefined {
  return campaigns.find((c) => c.slug === slug);
}

/**
 * Whether a campaign is running on a given date.
 *
 * A window that wraps the year (December into January) is the reason this is a
 * comparison on `MM-DD` rather than a range check: `12-01` to `01-06` is not an
 * interval you can test with two `<=`.
 */
export function isRunning(campaign: Campaign, on: Date = new Date()): boolean {
  const today = `${String(on.getUTCMonth() + 1).padStart(2, '0')}-${String(on.getUTCDate()).padStart(2, '0')}`;
  const { from, to } = campaign.window;
  return from <= to ? today >= from && today <= to : today >= from || today <= to;
}
