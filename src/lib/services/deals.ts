import { campaigns, isRunning, type Campaign } from '@/config/campaigns';
import type { Database } from '@/lib/domain/types';
import { defaultSearchQuery, search } from './search';
import type { CharterCard } from './charters';

/**
 * Seasonal deal pages.
 *
 * Built on top of `search()` rather than beside it: a deal page is a search
 * result with one extra rule applied, and running it through the same pipeline
 * means prices, availability and cards are computed exactly once, in one place.
 * A campaign that priced its cards differently from search would be a bug
 * waiting for someone to compare the two.
 */

export interface DealsPage {
  campaign: Campaign;
  running: boolean;
  charters: CharterCard[];
  /** Total before the campaign rule narrowed it, for honest empty copy. */
  consideredCount: number;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Applies a campaign's rule to a set of cards. */
export function applyCampaign(campaign: Campaign, cards: CharterCard[]): CharterCard[] {
  // Bound once so the switch narrows it — reading `campaign.filter` inside each
  // arm re-widens it back to the union on every access.
  const filter = campaign.filter;

  switch (filter.kind) {
    case 'award':
      return cards.filter((c) => c.hasBoatersChoiceAward);

    case 'instant_book':
      return cards.filter((c) => c.isInstantBookActive);

    case 'free_cancellation':
      return cards.filter((c) => c.freeCancellationDaysInAdvance >= filter.minDays);

    case 'best_rate': {
      // Measured against the set actually on offer, so the page stays honest as
      // inventory changes rather than against a number baked in last season.
      const prices = cards.map((c) => c.minPrice?.value).filter((v): v is number => typeof v === 'number');
      if (!prices.length) return [];

      const threshold = median(prices) * (1 - filter.percentBelowMedian / 100);
      return cards.filter((c) => (c.minPrice?.value ?? Infinity) <= threshold);
    }
  }
}

export function dealsPage(db: Database, campaign: Campaign, limit = 24): DealsPage {
  // No date and no destination: a campaign page is a browse surface, and
  // narrowing it to one day would empty it for no reason the visitor asked for.
  const result = search(db, { ...defaultSearchQuery(), perPage: 120, sort: 'price_asc' });

  const matching = applyCampaign(campaign, result.charters);

  return {
    campaign,
    running: isRunning(campaign),
    charters: matching.slice(0, limit),
    consideredCount: result.charters.length,
  };
}

/** Every campaign, running ones first — the index page's order. */
export function listCampaigns(on: Date = new Date()): { campaign: Campaign; running: boolean }[] {
  return campaigns
    .map((campaign) => ({ campaign, running: isRunning(campaign, on) }))
    .sort((a, b) => Number(b.running) - Number(a.running));
}
