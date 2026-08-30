'use client';

import { useMemo, useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import type { FacetGroup } from '@/lib/services/search';
import { Icon } from '@/components/ui/Icon';
import { Checkbox, Radio } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Filter panel.
 *
 * Renders whatever facets the search API returns rather than a hard-coded
 * list, so adding an amenity or activity to the taxonomy makes it filterable
 * with no change here. Counts come from the server's "all filters except this
 * one" pass, which is why a facet can show a non-zero count for an option that
 * is not currently selected.
 */

export interface FilterState {
  activities: string[];
  boatTypes: string[];
  amenities: string[];
  durations: string[];
  departureWindows: string[];
  priceMin?: number;
  priceMax?: number;
  minRating?: number;
  minCapacity?: number;
  instantBookOnly: boolean;
  freeCancellationOnly: boolean;
  tripType?: 'private' | 'shared';
}

export const emptyFilters = (): FilterState => ({
  activities: [],
  boatTypes: [],
  amenities: [],
  durations: [],
  departureWindows: [],
  instantBookOnly: false,
  freeCancellationOnly: false,
});

export function countActiveFilters(filters: FilterState): number {
  return (
    filters.activities.length +
    filters.boatTypes.length +
    filters.amenities.length +
    filters.durations.length +
    filters.departureWindows.length +
    (filters.priceMin !== undefined || filters.priceMax !== undefined ? 1 : 0) +
    (filters.minRating !== undefined ? 1 : 0) +
    (filters.minCapacity !== undefined ? 1 : 0) +
    (filters.instantBookOnly ? 1 : 0) +
    (filters.freeCancellationOnly ? 1 : 0) +
    (filters.tripType ? 1 : 0)
  );
}

/** How many options to show before a group collapses behind "show more". */
const COLLAPSE_AFTER = 6;

export function FilterPanel({
  facets,
  filters,
  onChange,
}: {
  facets: FacetGroup[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const toggleList = (key: 'activities' | 'boatTypes' | 'amenities' | 'durations' | 'departureWindows', value: string) => {
    const current = filters[key];
    onChange({
      ...filters,
      [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  };

  return (
    <div className="divide-y divide-line">
      {facets.map((facet) => {
        switch (facet.key) {
          case 'booking_options':
            return (
              <FilterGroup key={facet.key} title={facet.title}>
                <Checkbox
                  label={t('listingCard', 'instantBook')}
                  description={t('listingCard', 'instantBookTooltip')}
                  count={facet.options.find((o) => o.key === 'instant_book')?.count}
                  checked={filters.instantBookOnly}
                  onChange={(e) => onChange({ ...filters, instantBookOnly: e.target.checked })}
                />
                <Checkbox
                  label={t('listingCard', 'freeCancellation')}
                  count={facet.options.find((o) => o.key === 'free_cancellation')?.count}
                  checked={filters.freeCancellationOnly}
                  onChange={(e) => onChange({ ...filters, freeCancellationOnly: e.target.checked })}
                />
              </FilterGroup>
            );

          case 'price':
            return facet.range && facet.range.max > facet.range.min ? (
              <FilterGroup key={facet.key} title={facet.title}>
                <PriceRange
                  min={facet.range.min}
                  max={facet.range.max}
                  histogram={facet.range.histogram}
                  selectedMin={filters.priceMin}
                  selectedMax={filters.priceMax}
                  onChange={(priceMin, priceMax) => onChange({ ...filters, priceMin, priceMax })}
                />
              </FilterGroup>
            ) : null;

          case 'trip_type':
            return (
              <FilterGroup key={facet.key} title={facet.title}>
                {facet.options.map((option) => (
                  <Radio
                    key={option.key}
                    name="trip_type"
                    label={option.title}
                    count={option.count}
                    checked={filters.tripType === option.key}
                    onChange={() =>
                      onChange({
                        ...filters,
                        // Re-picking the selected option clears it, so a radio
                        // group is never a one-way door.
                        tripType: filters.tripType === option.key ? undefined : (option.key as 'private' | 'shared'),
                      })
                    }
                  />
                ))}
              </FilterGroup>
            );

          case 'capacity':
            return (
              <FilterGroup key={facet.key} title={facet.title}>
                {facet.options.map((option) => (
                  <Radio
                    key={option.key}
                    name="capacity"
                    label={option.title}
                    count={option.count}
                    checked={filters.minCapacity === Number(option.key)}
                    onChange={() =>
                      onChange({
                        ...filters,
                        minCapacity:
                          filters.minCapacity === Number(option.key) ? undefined : Number(option.key),
                      })
                    }
                  />
                ))}
              </FilterGroup>
            );

          case 'rating':
            return (
              <FilterGroup key={facet.key} title={facet.title}>
                {facet.options.map((option) => (
                  <Radio
                    key={option.key}
                    name="rating"
                    label={
                      <span className="flex items-center gap-1">
                        <Icon name="star" size={13} className="text-gold" strokeWidth={0} />
                        {t('search', 'ratingAtLeast', { score: option.key })}
                      </span>
                    }
                    count={option.count}
                    checked={filters.minRating === Number(option.key)}
                    onChange={() =>
                      onChange({
                        ...filters,
                        minRating: filters.minRating === Number(option.key) ? undefined : Number(option.key),
                      })
                    }
                  />
                ))}
              </FilterGroup>
            );

          default: {
            const listKey =
              facet.key === 'activities' ? 'activities'
              : facet.key === 'boat_types' ? 'boatTypes'
              : facet.key === 'amenities' ? 'amenities'
              : facet.key === 'durations' ? 'durations'
              : 'departureWindows';

            return facet.options.length ? (
              <FilterGroup key={facet.key} title={facet.title} collapsible={facet.options.length > COLLAPSE_AFTER}>
                {(expanded) =>
                  (expanded ? facet.options : facet.options.slice(0, COLLAPSE_AFTER)).map((option) => (
                    <Checkbox
                      key={option.key}
                      label={option.title}
                      count={option.count}
                      checked={(filters[listKey] as string[]).includes(option.key)}
                      onChange={() => toggleList(listKey, option.key)}
                    />
                  ))
                }
              </FilterGroup>
            ) : null;
          }
        }
      })}
    </div>
  );
}

function FilterGroup({
  title,
  collapsible,
  children,
}: {
  title: string;
  collapsible?: boolean;
  children: React.ReactNode | ((expanded: boolean) => React.ReactNode);
}) {
  const [expanded, setExpanded] = useState(false);
  const content = typeof children === 'function' ? children(expanded) : children;

  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <h3 className="mb-1 text-sm font-bold text-ink">{title}</h3>
      <div>{content}</div>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
        >
          {expanded ? t('general', 'seeLess') : t('general', 'seeMore')}
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
        </button>
      ) : null}
    </section>
  );
}

/**
 * Price range with an inventory histogram.
 *
 * Two native range inputs are stacked so the control stays fully keyboard
 * accessible and needs no drag handling; the thumbs are prevented from
 * crossing by clamping each against the other.
 */
function PriceRange({
  min,
  max,
  histogram,
  selectedMin,
  selectedMax,
  onChange,
}: {
  min: number;
  max: number;
  histogram: number[];
  selectedMin?: number;
  selectedMax?: number;
  onChange: (min: number | undefined, max: number | undefined) => void;
}) {
  const { format } = usePreferences();
  const lower = selectedMin ?? min;
  const upper = selectedMax ?? max;
  const peak = useMemo(() => Math.max(1, ...histogram), [histogram]);

  const toPercent = (value: number) => ((value - min) / Math.max(1, max - min)) * 100;

  return (
    <div>
      <div className="mb-2 flex items-end gap-0.5" aria-hidden="true">
        {histogram.map((count, index) => {
          const bucketStart = min + ((max - min) / histogram.length) * index;
          const inRange = bucketStart >= lower && bucketStart <= upper;
          return (
            <span
              key={index}
              className={cx('flex-1 rounded-sm transition-colors', inRange ? 'bg-brand-400' : 'bg-slate-200')}
              style={{ height: `${Math.max(4, (count / peak) * 40)}px` }}
            />
          );
        })}
      </div>

      <div className="relative h-6">
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-slate-200" />
        <span
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-brand-500"
          style={{ left: `${toPercent(lower)}%`, right: `${100 - toPercent(upper)}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={lower}
          aria-label={`Minimum price`}
          onChange={(e) => {
            const next = Math.min(Number(e.target.value), upper);
            onChange(next === min ? undefined : next, selectedMax);
          }}
          className="pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand-600 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={upper}
          aria-label={`Maximum price`}
          onChange={(e) => {
            const next = Math.max(Number(e.target.value), lower);
            onChange(selectedMin, next === max ? undefined : next);
          }}
          className="pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand-600 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
        />
      </div>

      <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
        {format(lower)} – {format(upper)}
        {upper === max ? '+' : ''}
      </p>
    </div>
  );
}
