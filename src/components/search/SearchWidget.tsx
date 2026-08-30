'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { formatDate, today } from '@/lib/core/dates';
import { api } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import { Button, Stepper } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import { DatePicker } from './DatePicker';

/**
 * The destination / date / group-size search widget.
 *
 * Appears on the home hero, on the search results header and on every
 * taxonomy landing page. On mobile each field opens a full sheet — tapping a
 * 44px target and picking from a large list beats typing into a cramped inline
 * control — while desktop expands the same fields inline.
 */

export interface SearchValues {
  destinationSlug?: string;
  destinationLabel?: string;
  date?: string;
  adults: number;
  children: number;
}

interface Suggestion {
  slug: string;
  title: string;
  label: string;
  charterCount: number;
}

const RECENT_KEY = 'bb_recent_destinations';

export function SearchWidget({
  initial,
  variant = 'hero',
  onSubmit,
}: {
  initial?: Partial<SearchValues>;
  variant?: 'hero' | 'bar' | 'inline';
  onSubmit?: (values: SearchValues) => void;
}) {
  const router = useRouter();

  const [values, setValues] = useState<SearchValues>({
    destinationSlug: initial?.destinationSlug,
    destinationLabel: initial?.destinationLabel,
    date: initial?.date,
    adults: initial?.adults ?? 2,
    children: initial?.children ?? 0,
  });

  const [openField, setOpenField] = useState<'destination' | 'date' | 'guests' | null>(null);
  const [locating, setLocating] = useState(false);

  // On the results page the destination's display name only arrives once the
  // search response resolves, after this component has already mounted. Sync
  // it in rather than leaving the field showing its placeholder.
  const syncedLabel = initial?.destinationLabel;
  const syncedSlug = initial?.destinationSlug;
  useEffect(() => {
    if (!syncedSlug && !syncedLabel) return;
    setValues((current) =>
      current.destinationSlug === syncedSlug && current.destinationLabel === syncedLabel
        ? current
        : { ...current, destinationSlug: syncedSlug, destinationLabel: syncedLabel },
    );
  }, [syncedSlug, syncedLabel]);

  const submit = useCallback(() => {
    if (onSubmit) {
      onSubmit(values);
      return;
    }

    const params = new URLSearchParams();
    if (values.destinationSlug) params.set('destination', values.destinationSlug);
    if (values.date) params.set('date', values.date);
    if (values.adults !== 2) params.set('adults', String(values.adults));
    if (values.children) params.set('children', String(values.children));

    router.push(`/charters/search?${params.toString()}`);
  }, [onSubmit, router, values]);

  /** "Near me" resolves coordinates in the browser and searches by radius. */
  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setOpenField(null);
        const params = new URLSearchParams({
          lat: position.coords.latitude.toFixed(5),
          lon: position.coords.longitude.toFixed(5),
          sort: 'distance',
        });
        if (values.date) params.set('date', values.date);
        if (values.adults !== 2) params.set('adults', String(values.adults));
        if (values.children) params.set('children', String(values.children));
        router.push(`/charters/search?${params.toString()}`);
      },
      () => {
        // Permission denied or unavailable: fall back to the normal search
        // rather than leaving the button stuck in a loading state.
        setLocating(false);
        setOpenField(null);
      },
      { timeout: 8000 },
    );
  }, [router, values]);

  const guestSummary = `${values.adults} ${values.adults === 1 ? 'adult' : 'adults'} · ${values.children} ${values.children === 1 ? 'child' : 'children'}`;
  const dateLabel = values.date ? formatDate(values.date, 'medium') : t('search', 'anyDate');
  const destinationLabel = values.destinationLabel ?? t('pickers', 'destinationPlaceholder');

  const isHero = variant === 'hero';

  return (
    <>
      <div
        className={cx(
          'w-full',
          isHero
            ? 'rounded-2xl bg-white p-2 shadow-pop md:flex md:items-center md:gap-1 md:p-2'
            : 'rounded-card border border-line bg-white p-1.5 md:flex md:items-center md:gap-1',
        )}
      >
        <FieldButton
          icon="map-pin"
          label={t('pickers', 'destinationLabel')}
          value={destinationLabel}
          placeholder={!values.destinationSlug}
          onClick={() => setOpenField('destination')}
          className="md:flex-[1.4]"
        />
        <span className="mx-2 hidden h-8 w-px bg-line md:block" />
        <FieldButton
          icon="calendar"
          label={t('pickers', 'tripDateLabel')}
          value={dateLabel}
          placeholder={!values.date}
          onClick={() => setOpenField('date')}
        />
        <span className="mx-2 hidden h-8 w-px bg-line md:block" />
        <FieldButton
          icon="users"
          label={t('pickers', 'groupSizeLabel')}
          value={guestSummary}
          onClick={() => setOpenField('guests')}
        />

        <Button
          size={isHero ? 'lg' : 'md'}
          onClick={submit}
          icon="search"
          className={cx('mt-2 w-full md:mt-0 md:w-auto md:shrink-0', isHero && 'md:px-6')}
        >
          {isHero ? t('homepage', 'searchCta') : t('general', 'search')}
        </Button>
      </div>

      {/* Destination picker */}
      <Overlay
        open={openField === 'destination'}
        onClose={() => setOpenField(null)}
        title={t('pickers', 'destinationLabel')}
        size="md"
      >
        <DestinationPicker
          locating={locating}
          onUseLocation={useMyLocation}
          onSelect={(suggestion) => {
            setValues((v) => ({
              ...v,
              destinationSlug: suggestion.slug,
              destinationLabel: suggestion.label,
            }));
            rememberDestination(suggestion);
            setOpenField(null);
          }}
        />
      </Overlay>

      {/* Date picker */}
      <Overlay
        open={openField === 'date'}
        onClose={() => setOpenField(null)}
        title={t('pickers', 'tripDateLabel')}
        size="md"
        footer={
          <div className="flex gap-2">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setValues((v) => ({ ...v, date: undefined }));
                setOpenField(null);
              }}
            >
              {t('pickers', 'noSpecificDate')}
            </Button>
            <Button fullWidth onClick={() => setOpenField(null)}>
              {t('general', 'done')}
            </Button>
          </div>
        }
      >
        <DatePicker
          value={values.date}
          min={today()}
          onChange={(date) => setValues((v) => ({ ...v, date }))}
          months={2}
        />
      </Overlay>

      {/* Guest picker */}
      <Overlay
        open={openField === 'guests'}
        onClose={() => setOpenField(null)}
        title={t('pickers', 'groupSizeLabel')}
        size="sm"
        footer={
          <Button fullWidth onClick={() => setOpenField(null)}>
            {t('general', 'done')}
          </Button>
        }
      >
        <Stepper
          label={t('pickers', 'adults')}
          value={values.adults}
          min={1}
          max={60}
          onChange={(adults) => setValues((v) => ({ ...v, adults }))}
        />
        <Stepper
          label={t('pickers', 'children')}
          sublabel={t('pickers', 'childrenAges')}
          value={values.children}
          min={0}
          max={40}
          onChange={(children) => setValues((v) => ({ ...v, children }))}
        />
      </Overlay>
    </>
  );
}

function FieldButton({
  icon,
  label,
  value,
  placeholder,
  onClick,
  className,
}: {
  icon: string;
  label: string;
  value: string;
  placeholder?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-surface-sunken md:flex-1',
        className,
      )}
    >
      <Icon name={icon} size={18} className="shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
        <span className={cx('block truncate text-sm', placeholder ? 'text-ink-faint' : 'font-semibold text-ink')}>
          {value}
        </span>
      </span>
    </button>
  );
}

function DestinationPicker({
  onSelect,
  onUseLocation,
  locating,
}: {
  onSelect: (suggestion: Suggestion) => void;
  onUseLocation: () => void;
  locating: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(readRecentDestinations());
    inputRef.current?.focus();
  }, []);

  // Debounced lookup, with the in-flight request aborted whenever the query
  // changes so a slow response cannot overwrite a newer one.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<Suggestion[]>(
          `/api/destinations?q=${encodeURIComponent(query)}&limit=10`,
          controller.signal,
        );
        setResults(data);
      } catch {
        // Aborted or offline; the previous list stays on screen.
      } finally {
        setLoading(false);
      }
    }, query ? 200 : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('pickers', 'destinationPlaceholder')}
          aria-label={t('pickers', 'destinationLabel')}
          className="h-11 w-full rounded-control border border-line pl-10 pr-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        />
      </div>

      <button
        type="button"
        onClick={onUseLocation}
        disabled={locating}
        className="flex items-center gap-3 rounded-control border border-line px-3 py-2.5 text-left transition-colors hover:bg-surface-sunken disabled:opacity-60"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Icon name="map-pin" size={16} />
        </span>
        <span className="text-sm font-semibold text-ink">
          {locating ? t('pickers', 'loadingCurrentLocation') : t('pickers', 'useMyLocation')}
        </span>
      </button>

      {!query && recent.length ? (
        <section>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-faint">
            {t('pickers', 'recentSearches')}
          </h3>
          <ul>
            {recent.map((item) => (
              <SuggestionRow key={`recent-${item.slug}`} suggestion={item} onSelect={onSelect} icon="clock" />
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-faint">
          {query ? t('general', 'search') : t('pickers', 'popularDestinations')}
        </h3>
        {loading && !results.length ? (
          <p className="py-4 text-sm text-ink-muted">{t('general', 'loading')}</p>
        ) : results.length ? (
          <ul>
            {results.map((item) => (
              <SuggestionRow key={item.slug} suggestion={item} onSelect={onSelect} icon="map-pin" />
            ))}
          </ul>
        ) : (
          <p className="py-4 text-sm text-ink-muted">{t('pickers', 'noMatches', { query })}</p>
        )}
      </section>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  onSelect,
  icon,
}: {
  suggestion: Suggestion;
  onSelect: (suggestion: Suggestion) => void;
  icon: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(suggestion)}
        className="flex w-full items-center gap-3 rounded-control px-1 py-2.5 text-left transition-colors hover:bg-surface-sunken"
      >
        <Icon name={icon} size={16} className="shrink-0 text-ink-muted" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{suggestion.title}</span>
          <span className="block truncate text-xs text-ink-muted">{suggestion.label}</span>
        </span>
        <span className="shrink-0 text-xs text-ink-faint">{suggestion.charterCount}</span>
      </button>
    </li>
  );
}

function readRecentDestinations(): Suggestion[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as Suggestion[]).slice(0, 4) : [];
  } catch {
    return [];
  }
}

function rememberDestination(suggestion: Suggestion): void {
  try {
    const current = readRecentDestinations().filter((item) => item.slug !== suggestion.slug);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify([suggestion, ...current].slice(0, 4)));
  } catch {
    // Storage unavailable — recents simply will not persist.
  }
}
