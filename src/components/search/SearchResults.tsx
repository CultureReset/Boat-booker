'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { api } from '@/lib/client/api';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { useSession } from '@/components/providers/SessionProvider';
import type { CharterCard } from '@/lib/services/charters';
import type { FacetGroup, SortKey } from '@/lib/services/search';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import { Badge, Button, EmptyState, Select } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import { ListingCard, ListingCardSkeleton } from '@/components/listing/ListingCard';
import { SearchWidget, type SearchValues } from './SearchWidget';
import { FilterPanel, countActiveFilters, emptyFilters, type FilterState } from './FilterPanel';
import { ResultsMap } from './ResultsMap';

/**
 * Search results.
 *
 * The URL is the single source of truth for the query: every filter, sort and
 * page change rewrites it, and the fetch is driven off what the URL says. That
 * makes results shareable, back/forward behave correctly, and a reload land on
 * exactly the same page.
 */

interface SearchResponse {
  charters: CharterCard[];
  facets: FacetGroup[];
}

interface SearchMetadata {
  page: number;
  perPage: number;
  pageCount: number;
  totalCount: number;
  availableCount: number;
  destination?: { slug: string; title: string; blurb: string; stateAbbrev?: string; countryTitle: string };
  nextAvailableDates: string[];
  nearbyDestinations: { slug: string; title: string; charterCount: number; distanceKm: number }[];
  priceBounds: { min: number; max: number };
}

const SORT_OPTIONS: { key: SortKey; labelKey: string }[] = [
  { key: 'recommended', labelKey: 'sortRecommended' },
  { key: 'price_asc', labelKey: 'sortPriceAsc' },
  { key: 'price_desc', labelKey: 'sortPriceDesc' },
  { key: 'rating', labelKey: 'sortRating' },
  { key: 'distance', labelKey: 'sortDistance' },
  { key: 'newest', labelKey: 'sortNewest' },
];

export function SearchResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency } = usePreferences();
  const { user } = useSession();

  const [data, setData] = useState<SearchResponse | null>(null);
  const [metadata, setMetadata] = useState<SearchMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const requestId = useRef(0);

  // --- Query state, read straight from the URL ----------------------------
  const query = useMemo(() => {
    const list = (key: string) => searchParams.get(key)?.split(',').filter(Boolean) ?? [];
    const num = (key: string) => {
      const raw = searchParams.get(key);
      return raw === null || raw === '' ? undefined : Number(raw);
    };
    return {
      destination: searchParams.get('destination') ?? undefined,
      date: searchParams.get('date') ?? undefined,
      adults: Number(searchParams.get('adults')) || 2,
      children: Number(searchParams.get('children')) || 0,
      sort: (searchParams.get('sort') as SortKey) ?? 'recommended',
      page: Number(searchParams.get('page')) || 1,
      lat: searchParams.get('lat'),
      lon: searchParams.get('lon'),
      filters: {
        activities: list('activities'),
        boatTypes: list('boat_types'),
        amenities: list('amenities'),
        durations: list('durations'),
        departureWindows: list('departure'),
        priceMin: num('price_min'),
        priceMax: num('price_max'),
        minRating: num('rating'),
        minCapacity: num('capacity'),
        instantBookOnly: searchParams.get('instant_book') === 'true',
        freeCancellationOnly: searchParams.get('free_cancellation') === 'true',
        tripType: (searchParams.get('trip_type') as 'private' | 'shared') || undefined,
      } satisfies FilterState,
    };
  }, [searchParams]);

  const activeFilterCount = countActiveFilters(query.filters);

  /** Rewrite the URL, resetting to page 1 unless the page itself changed. */
  const updateUrl = useCallback(
    (mutate: (params: URLSearchParams) => void, { resetPage = true } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      if (resetPage) params.delete('page');
      router.push(`/charters/search?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const applyFilters = useCallback(
    (next: FilterState) => {
      updateUrl((params) => {
        const setList = (key: string, values: string[]) => {
          if (values.length) params.set(key, values.join(','));
          else params.delete(key);
        };
        const setValue = (key: string, value: unknown) => {
          if (value === undefined || value === false || value === '') params.delete(key);
          else params.set(key, String(value));
        };

        setList('activities', next.activities);
        setList('boat_types', next.boatTypes);
        setList('amenities', next.amenities);
        setList('durations', next.durations);
        setList('departure', next.departureWindows);
        setValue('price_min', next.priceMin);
        setValue('price_max', next.priceMax);
        setValue('rating', next.minRating);
        setValue('capacity', next.minCapacity);
        setValue('instant_book', next.instantBookOnly || undefined);
        setValue('free_cancellation', next.freeCancellationOnly || undefined);
        setValue('trip_type', next.tripType);
      });
    },
    [updateUrl],
  );

  const applySearch = useCallback(
    (values: SearchValues) => {
      updateUrl((params) => {
        if (values.destinationSlug) params.set('destination', values.destinationSlug);
        else params.delete('destination');
        if (values.date) params.set('date', values.date);
        else params.delete('date');
        params.set('adults', String(values.adults));
        if (values.children) params.set('children', String(values.children));
        else params.delete('children');
        // A named destination supersedes a "near me" coordinate search.
        if (values.destinationSlug) {
          params.delete('lat');
          params.delete('lon');
        }
      });
    },
    [updateUrl],
  );

  // --- Fetch ---------------------------------------------------------------
  useEffect(() => {
    const controller = new AbortController();
    const id = requestId.current + 1;
    requestId.current = id;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams(searchParams.toString());
    params.set('currency', currency);
    params.set('per_page', '12');

    api
      .getWithMeta<SearchResponse>(`/api/search?${params.toString()}`, controller.signal)
      .then((result) => {
        // Ignore a response that a newer request has already superseded.
        if (requestId.current !== id) return;
        setData(result.data);
        setMetadata(result.metadata as SearchMetadata);
        setLoading(false);
      })
      .catch((caught) => {
        if (controller.signal.aborted || requestId.current !== id) return;
        setError(caught instanceof Error ? caught.message : t('general', 'error'));
        setLoading(false);
      });

    return () => controller.abort();
  }, [searchParams, currency]);

  // Saved listings, so the hearts are correct on first paint.
  useEffect(() => {
    if (!user) {
      setSavedIds(new Set());
      return;
    }
    api
      .get<{ id: string }[]>('/api/wishlist')
      .then((items) => setSavedIds(new Set(items.map((i) => i.id))))
      .catch(() => {});
  }, [user]);

  const charters = data?.charters ?? [];
  const facets = data?.facets ?? [];
  const cardParams = searchParams.toString();

  const heading = metadata?.destination
    ? t('destinations', 'inDestination', { destination: metadata.destination.title })
    : query.lat
      ? t('pickers', 'nearYourLocation')
      : t('search', 'filters');

  return (
    <div className="mx-auto max-w-shell px-4 py-4 md:py-6">
      {/* ------------------------------------------------ search header */}
      <div className="mb-4">
        <SearchWidget
          variant="bar"
          initial={{
            destinationSlug: query.destination,
            destinationLabel: metadata?.destination
              ? [metadata.destination.title, metadata.destination.stateAbbrev, metadata.destination.countryTitle]
                  .filter(Boolean)
                  .join(', ')
              : undefined,
            date: query.date,
            adults: query.adults,
            children: query.children,
          }}
          onSubmit={applySearch}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold text-ink md:text-2xl">{heading}</h1>
          <p className="mt-0.5 text-sm text-ink-muted" aria-live="polite">
            {loading
              ? t('search', 'loaderTitle')
              : t('search', 'resultsCount', { count: metadata?.totalCount ?? 0 })}
            {query.date ? ` · ${formatDate(query.date, 'medium')}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="flex h-10 items-center gap-1.5 rounded-control border border-line px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken lg:hidden"
          >
            <Icon name="filter" size={16} />
            {t('search', 'filters')}
            {activeFilterCount > 0 ? <Badge tone="brand">{activeFilterCount}</Badge> : null}
          </button>

          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="flex h-10 items-center gap-1.5 rounded-control border border-line px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken lg:hidden"
          >
            <Icon name="map" size={16} />
            {t('search', 'map')}
          </button>

          <label className="hidden items-center gap-2 sm:flex">
            <span className="text-sm text-ink-muted">{t('search', 'sortBy')}</span>
            <Select
              value={query.sort}
              onChange={(e) => updateUrl((params) => params.set('sort', e.target.value))}
              className="h-10 w-44"
            >
              {SORT_OPTIONS.filter((option) => option.key !== 'distance' || query.lat).map((option) => (
                <option key={option.key} value={option.key}>
                  {t('search', option.labelKey)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {renderFilterChips(query.filters, facets, applyFilters)}
          <button
            type="button"
            onClick={() => applyFilters(emptyFilters())}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            {t('search', 'deselectAllFilters')}
          </button>
        </div>
      ) : null}

      <div className="flex gap-6">
        {/* ------------------------------------------- desktop sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-1">
            <h2 className="mb-2 text-sm font-bold text-ink">{t('search', 'filterResultsBy')}</h2>
            {loading && !facets.length ? (
              <p className="text-sm text-ink-muted">{t('search', 'filterLoaderTitle')}</p>
            ) : (
              <FilterPanel facets={facets} filters={query.filters} onChange={applyFilters} />
            )}
          </div>
        </aside>

        {/* ------------------------------------------------------ results */}
        <div className="min-w-0 flex-1">
          {error ? (
            <EmptyState
              icon="alert"
              title={t('errors', 'serverErrorTitle')}
              body={error}
              action={
                <Button onClick={() => router.refresh()} icon="refresh">
                  {t('errors', 'tryAgain')}
                </Button>
              }
            />
          ) : loading ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <li key={index}>
                  <ListingCardSkeleton />
                </li>
              ))}
            </ul>
          ) : charters.length ? (
            <>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {charters.map((charter, index) => (
                  <li key={charter.id}>
                    <ListingCard
                      charter={charter}
                      searchParams={cardParams}
                      index={index}
                      total={metadata?.totalCount ?? charters.length}
                      saved={savedIds.has(charter.id)}
                      onToggleSaved={(id, saved) =>
                        setSavedIds((current) => {
                          const next = new Set(current);
                          if (saved) next.add(id);
                          else next.delete(id);
                          return next;
                        })
                      }
                    />
                  </li>
                ))}
              </ul>

              {metadata && metadata.pageCount > 1 ? (
                <Pagination
                  page={metadata.page}
                  pageCount={metadata.pageCount}
                  onChange={(page) =>
                    updateUrl((params) => params.set('page', String(page)), { resetPage: false })
                  }
                />
              ) : null}
            </>
          ) : (
            <EmptySearch
              metadata={metadata}
              hasFilters={activeFilterCount > 0}
              hasDate={Boolean(query.date)}
              onClearFilters={() => applyFilters(emptyFilters())}
              onClearDate={() => updateUrl((params) => params.delete('date'))}
              onPickDate={(date) => updateUrl((params) => params.set('date', date))}
            />
          )}

          {/* Nearby destinations, shown when the current one is thin */}
          {!loading && metadata?.nearbyDestinations.length ? (
            <section className="mt-8">
              <h2 className="mb-1 text-base font-bold text-ink">{t('search', 'nearbyDestinations')}</h2>
              <p className="mb-3 text-sm text-ink-muted">{t('search', 'nearbyDestinationsSubtitle')}</p>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {metadata.nearbyDestinations.map((destination) => (
                  <li key={destination.slug}>
                    <Link
                      href={`/charters/search?destination=${destination.slug}`}
                      className="flex items-center justify-between gap-2 rounded-control border border-line bg-white px-3 py-2.5 transition-colors hover:border-brand-400"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{destination.title}</span>
                        <span className="block text-xs text-ink-muted">
                          {t('destinations', 'charterCount', { count: destination.charterCount })}
                        </span>
                      </span>
                      <Icon name="chevron-right" size={16} className="shrink-0 text-ink-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {metadata?.destination?.blurb && !loading ? (
            <section className="mt-8 rounded-card border border-line bg-surface-sunken p-5">
              <h2 className="mb-2 text-base font-bold text-ink">
                {t('destinations', 'aboutDestination', { destination: metadata.destination.title })}
              </h2>
              <p className="text-sm leading-relaxed text-ink-soft">{metadata.destination.blurb}</p>
            </section>
          ) : null}
        </div>

        {/* ------------------------------------------------ desktop map */}
        <aside className="hidden w-80 shrink-0 xl:block">
          <div className="sticky top-20">
            <ResultsMap charters={charters} searchParams={cardParams} className="h-[calc(100dvh-7rem)]" />
          </div>
        </aside>
      </div>

      {/* ------------------------------------------------- mobile sheets */}
      <Overlay
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('search', 'filterModalTitle')}
        size="full"
        footer={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => applyFilters(emptyFilters())}
              disabled={activeFilterCount === 0}
            >
              {t('search', 'deselectAllFilters')}
            </Button>
            <Button fullWidth onClick={() => setFiltersOpen(false)}>
              {t('search', 'showXResults', { count: metadata?.totalCount ?? 0 })}
            </Button>
          </div>
        }
      >
        <div className="mb-4 sm:hidden">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">{t('search', 'sortBy')}</span>
            <Select
              value={query.sort}
              onChange={(e) => updateUrl((params) => params.set('sort', e.target.value))}
            >
              {SORT_OPTIONS.filter((option) => option.key !== 'distance' || query.lat).map((option) => (
                <option key={option.key} value={option.key}>
                  {t('search', option.labelKey)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <FilterPanel facets={facets} filters={query.filters} onChange={applyFilters} />
      </Overlay>

      <Overlay open={mapOpen} onClose={() => setMapOpen(false)} title={t('search', 'mapView')} size="full" hideHeader>
        <div className="-mx-4 -my-4 h-[92dvh]">
          <ResultsMap
            charters={charters}
            searchParams={cardParams}
            onClose={() => setMapOpen(false)}
            className="h-full rounded-none"
          />
        </div>
      </Overlay>
    </div>
  );
}

function renderFilterChips(
  filters: FilterState,
  facets: FacetGroup[],
  onChange: (next: FilterState) => void,
) {
  const chips: { key: string; label: string; clear: () => void }[] = [];

  const titleFor = (facetKey: string, optionKey: string) =>
    facets.find((f) => f.key === facetKey)?.options.find((o) => o.key === optionKey)?.title ?? optionKey;

  const addList = (
    facetKey: string,
    stateKey: 'activities' | 'boatTypes' | 'amenities' | 'durations' | 'departureWindows',
  ) => {
    for (const value of filters[stateKey]) {
      chips.push({
        key: `${stateKey}-${value}`,
        label: titleFor(facetKey, value),
        clear: () =>
          onChange({ ...filters, [stateKey]: filters[stateKey].filter((v) => v !== value) }),
      });
    }
  };

  addList('activities', 'activities');
  addList('boat_types', 'boatTypes');
  addList('amenities', 'amenities');
  addList('durations', 'durations');
  addList('departure', 'departureWindows');

  if (filters.instantBookOnly) {
    chips.push({
      key: 'instant',
      label: t('listingCard', 'instantBook'),
      clear: () => onChange({ ...filters, instantBookOnly: false }),
    });
  }
  if (filters.freeCancellationOnly) {
    chips.push({
      key: 'free-cancel',
      label: t('listingCard', 'freeCancellation'),
      clear: () => onChange({ ...filters, freeCancellationOnly: false }),
    });
  }
  if (filters.tripType) {
    chips.push({
      key: 'trip-type',
      label: filters.tripType === 'private' ? t('search', 'privateTrip') : t('search', 'sharedTrip'),
      clear: () => onChange({ ...filters, tripType: undefined }),
    });
  }
  if (filters.minRating !== undefined) {
    chips.push({
      key: 'rating',
      label: t('search', 'ratingAtLeast', { score: filters.minRating }),
      clear: () => onChange({ ...filters, minRating: undefined }),
    });
  }
  if (filters.minCapacity !== undefined) {
    chips.push({
      key: 'capacity',
      label: `${filters.minCapacity}+ guests`,
      clear: () => onChange({ ...filters, minCapacity: undefined }),
    });
  }
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    chips.push({
      key: 'price',
      label: t('search', 'priceRange'),
      clear: () => onChange({ ...filters, priceMin: undefined, priceMax: undefined }),
    });
  }

  return chips.map((chip) => (
    <button
      key={chip.key}
      type="button"
      onClick={chip.clear}
      className="flex h-8 items-center gap-1.5 rounded-full bg-brand-50 pl-3 pr-2 text-xs font-semibold text-brand-800 transition-colors hover:bg-brand-100"
    >
      {chip.label}
      <Icon name="close" size={12} strokeWidth={2.4} />
    </button>
  ));
}

function EmptySearch({
  metadata,
  hasFilters,
  hasDate,
  onClearFilters,
  onClearDate,
  onPickDate,
}: {
  metadata: SearchMetadata | null;
  hasFilters: boolean;
  hasDate: boolean;
  onClearFilters: () => void;
  onClearDate: () => void;
  onPickDate: (date: string) => void;
}) {
  const nextDates = metadata?.nextAvailableDates ?? [];

  return (
    <div className="space-y-4">
      <EmptyState
        icon="search"
        title={t('search', 'emptyTitle')}
        body={hasFilters ? t('search', 'emptyFiltersBody') : t('search', 'emptyBody')}
        action={
          hasFilters ? (
            <Button onClick={onClearFilters} variant="outline">
              {t('search', 'resetFilters')}
            </Button>
          ) : hasDate ? (
            <Button onClick={onClearDate} variant="outline">
              {t('search', 'anyDate')}
            </Button>
          ) : undefined
        }
      />

      {nextDates.length ? (
        <div className="rounded-card border border-line bg-white p-4">
          <h3 className="mb-2 text-sm font-bold text-ink">{t('search', 'nextAvailableDates')}</h3>
          <div className="flex flex-wrap gap-2">
            {nextDates.map((date) => (
              <button
                key={date}
                type="button"
                onClick={() => onPickDate(date)}
                className="flex h-10 items-center rounded-control border border-line px-3 text-sm font-semibold text-ink transition-colors hover:border-brand-500 hover:bg-brand-50"
              >
                {formatDate(date, 'medium')}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  // Show a compact window around the current page rather than every number.
  const pages = useMemo(() => {
    const window = 2;
    const set = new Set<number>([1, pageCount]);
    for (let p = page - window; p <= page + window; p += 1) {
      if (p >= 1 && p <= pageCount) set.add(p);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [page, pageCount]);

  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label={t('search', 'prev')}
        className="flex h-10 w-10 items-center justify-center rounded-control border border-line text-ink transition-colors hover:bg-surface-sunken disabled:opacity-40"
      >
        <Icon name="chevron-left" size={18} />
      </button>

      {pages.map((value, index) => (
        <span key={value} className="flex items-center">
          {index > 0 && value - pages[index - 1] > 1 ? (
            <span className="px-1 text-ink-faint">…</span>
          ) : null}
          <button
            type="button"
            onClick={() => onChange(value)}
            aria-current={value === page ? 'page' : undefined}
            className={cx(
              'flex h-10 min-w-10 items-center justify-center rounded-control px-3 text-sm font-semibold transition-colors',
              value === page ? 'bg-ink text-white' : 'border border-line text-ink hover:bg-surface-sunken',
            )}
          >
            {value}
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label={t('search', 'next')}
        className="flex h-10 w-10 items-center justify-center rounded-control border border-line text-ink transition-colors hover:bg-surface-sunken disabled:opacity-40"
      >
        <Icon name="chevron-right" size={18} />
      </button>
    </nav>
  );
}
