'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { translate as t } from '@/i18n/translate';
import type { CharterCard } from '@/lib/services/charters';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { RatingSummary } from '@/components/ui/primitives';

/**
 * Results map.
 *
 * A self-contained SVG map rather than a third-party tile provider: it needs
 * no API key, works offline in the app shell, and — because listing positions
 * are the only thing that actually matters here — loses nothing that helps a
 * guest choose. Swapping in Mapbox or Google later means replacing this one
 * component; the props are already the shape a tile map would want.
 *
 * Coordinates are projected with a Web Mercator y-transform so the relative
 * positions match what a real map would show.
 */

export interface MapMarker {
  charter: CharterCard;
}

export function ResultsMap({
  charters,
  searchParams,
  onClose,
  className,
}: {
  charters: CharterCard[];
  searchParams?: string;
  onClose?: () => void;
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Bounding box over every result, padded so no pin sits on the edge.
  const bounds = useMemo(() => {
    if (!charters.length) return null;

    const lats = charters.map((c) => c.geoPoint.lat);
    const lons = charters.map((c) => c.geoPoint.lon);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // A single result would give a zero-size box; give it a small window.
    const latPad = Math.max((maxLat - minLat) * 0.15, 0.02);
    const lonPad = Math.max((maxLon - minLon) * 0.15, 0.02);

    return {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLon: minLon - lonPad,
      maxLon: maxLon + lonPad,
    };
  }, [charters]);

  /** Web Mercator latitude projection, so north–south spacing is truthful. */
  const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

  const project = (point: { lat: number; lon: number }) => {
    if (!bounds) return { x: 50, y: 50 };
    const x = ((point.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 100;
    const yTop = mercator(bounds.maxLat);
    const yBottom = mercator(bounds.minLat);
    const y = ((yTop - mercator(point.lat)) / (yTop - yBottom)) * 100;
    return { x, y };
  };

  const active = charters.find((c) => c.id === activeId) ?? null;

  return (
    <div className={cx('relative overflow-hidden rounded-card bg-[#dfeaf3]', className)}>
      {/* Water texture and a suggestion of landmass, purely decorative. */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
        <defs>
          <pattern id="map-grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0H0V8" fill="none" stroke="#c3d7e6" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#map-grid)" />
        <path d="M0 68 Q18 60 34 66 T68 62 T100 70 L100 100 L0 100 Z" fill="#e8efe4" opacity="0.9" />
        <path d="M0 68 Q18 60 34 66 T68 62 T100 70" fill="none" stroke="#bcd0c2" strokeWidth="0.5" />
      </svg>

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-semibold text-ink shadow-pop"
        >
          <Icon name="list" size={16} />
          {t('search', 'listView')}
        </button>
      ) : null}

      {!charters.length ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
          {t('search', 'emptyTitle')}
        </p>
      ) : null}

      {/* Price pins */}
      <ul className="absolute inset-0">
        {charters.map((charter) => {
          const { x, y } = project(charter.geoPoint);
          const isActive = charter.id === activeId;

          return (
            <li
              key={charter.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%`, zIndex: isActive ? 30 : 10 }}
            >
              <button
                type="button"
                onClick={() => setActiveId(isActive ? null : charter.id)}
                aria-pressed={isActive}
                aria-label={`${charter.title} — ${charter.minPrice?.displayValue ?? ''}`}
                className={cx(
                  'whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold shadow transition-transform hover:scale-105',
                  isActive
                    ? 'border-ink bg-ink text-white'
                    : 'border-white bg-white text-ink hover:border-brand-400',
                )}
              >
                {charter.minPrice?.displayValue ?? charter.title.slice(0, 12)}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Preview card for the selected pin */}
      {active ? (
        <div className="absolute inset-x-3 bottom-3 z-40">
          <Link
            href={`/charters/view/${active.id}${searchParams ? `?${searchParams}` : ''}`}
            className="flex items-center gap-3 rounded-card bg-white p-2 shadow-pop"
          >
            <span
              className="h-16 w-20 shrink-0 rounded-lg bg-slate-200"
              style={{ backgroundImage: active.photo.placeholder }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{active.title}</span>
              <span className="block truncate text-xs text-ink-muted">
                {active.boatType} · {t('listingCard', 'capacity', { count: active.capacity, p: active.capacity })}
              </span>
              {active.reviewStatistics.reviewCount > 0 ? (
                <RatingSummary
                  rating={active.reviewStatistics.rating}
                  count={active.reviewStatistics.reviewCount}
                  size="sm"
                  className="mt-0.5"
                />
              ) : null}
            </span>
            <span className="shrink-0 pr-1 text-right">
              <span className="block text-sm font-extrabold text-ink">
                {active.minPrice?.displayValue}
              </span>
              <Icon name="chevron-right" size={16} className="ml-auto text-ink-faint" />
            </span>
          </Link>
        </div>
      ) : null}

      <p className="absolute bottom-1 right-2 text-[10px] text-ink-faint">
        {t('maps', 'approximateLocation')}
      </p>
    </div>
  );
}
