'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { Icon } from '@/components/ui/Icon';
import { PhotoFrame } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import type { MemoryScene, TripMemory } from '@/lib/services/memories';

/**
 * The trip-memory player.
 *
 * A story format — one idea per screen, tap or swipe to advance — because the
 * content is nostalgic rather than informational, and a scrolling page would
 * turn seven small moments into one long one nobody finishes.
 *
 * Keyboard and reduced-motion are handled properly: this is a marketing surface
 * but it is still an interface, and "delightful" is not a reason to be
 * unnavigable.
 */
export function MemoryPlayer({ memory }: { memory: TripMemory }) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const total = memory.scenes.length;
  const scene = memory.scenes[index];

  const go = useCallback(
    (delta: number) => setIndex((current) => Math.min(total - 1, Math.max(0, current + delta))),
    [total],
  );

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        go(1);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-brand-950 text-white">
      {/* Progress rail */}
      <div className="flex shrink-0 gap-1 p-3 safe-top">
        {memory.scenes.map((_, i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            <span
              className={cx('block h-full rounded-full bg-white', i <= index ? 'w-full' : 'w-0')}
            />
          </span>
        ))}
      </div>

      <div
        key={index}
        className={cx(
          'flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-8 text-center',
          !reducedMotion && 'animate-[fade-up_.45s_ease-out]',
        )}
      >
        <Scene scene={scene} memory={memory} />
      </div>

      {/* Controls. Big tap targets either side, visible buttons underneath —
          an invisible tap zone alone is undiscoverable and unreachable by
          keyboard or screen reader. */}
      <div className="flex shrink-0 items-center justify-between gap-3 p-4 safe-bottom">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="flex items-center gap-1 rounded-full px-4 py-2.5 text-sm font-semibold text-white/80 transition-opacity disabled:opacity-30"
        >
          <Icon name="chevron-left" size={16} />
          {t('memories', 'back')}
        </button>

        {index === total - 1 ? (
          <button
            type="button"
            onClick={() => setIndex(0)}
            className="flex items-center gap-1 rounded-full px-4 py-2.5 text-sm font-semibold text-white/80"
          >
            <Icon name="refresh" size={16} />
            {t('memories', 'replay')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(1)}
            className="flex items-center gap-1 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-900"
          >
            {t('memories', 'next')}
            <Icon name="chevron-right" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function Scene({ scene, memory }: { scene: MemoryScene; memory: TripMemory }) {
  switch (scene.key) {
    case 'intro':
      return (
        <>
          <span className="text-5xl" aria-hidden>
            👋
          </span>
          <h1 className="mt-4 text-3xl font-bold">
            {t('memories', 'introGreeting', { name: String(scene.name) })}
          </h1>
          <p className="mt-2 max-w-xs text-white/80">{t('memories', 'introDescription')}</p>
        </>
      );

    case 'the_trip':
      return (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide text-white/60">
            {t('memories', 'theTripTitle')}
          </p>
          <PhotoFrame
            photo={scene.photo as { placeholder: string; altText: string } | null}
            rounded="rounded-2xl"
            className="mt-3 aspect-[4/3] w-full max-w-sm"
          />
          <h2 className="mt-4 text-2xl font-bold">{String(scene.title)}</h2>
          <p className="mt-1 text-white/80">
            {formatDate(String(scene.date), 'long')} · {String(scene.destination)}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {t('memories', 'theTripGuests', { count: Number(scene.guests) })}
          </p>
          <p className="mt-3 text-sm font-semibold text-white/70">
            {t('memories', 'yearsAgo', { count: memory.yearsAgo, years: memory.yearsAgo })}
          </p>
        </>
      );

    case 'others_enjoyed':
      return (
        <>
          <span className="text-5xl" aria-hidden>
            ⚓
          </span>
          <h2 className="mt-4 max-w-xs text-2xl font-bold">
            {t('memories', 'othersEnjoyedTitle')}
          </h2>
          <p className="mt-2 text-white/80">
            {t('memories', 'othersEnjoyedBody', { count: Number(scene.count) })}
          </p>
        </>
      );

    case 'captain_reputation':
      return (
        <>
          <span className="text-5xl" aria-hidden>
            ⭐
          </span>
          <h2 className="mt-4 max-w-xs text-2xl font-bold">{t('memories', 'reputationTitle')}</h2>
          <p className="mt-2 max-w-sm text-white/80">
            {Number(scene.reviewsSince) > 0
              ? t('memories', 'reputationBody', {
                  captain: String(scene.captainName),
                  count: String(scene.reviewsSince),
                  score: Number(scene.averageSince).toFixed(1),
                })
              : t('memories', 'reputationNone', { captain: String(scene.captainName) })}
          </p>
        </>
      );

    case 'same_dates': {
      const dates = scene.dates as string[];
      const fullyBooked = Boolean(scene.fullyBooked);
      const discount = Number(scene.discountPercent);

      return (
        <>
          <h2 className="max-w-xs text-2xl font-bold">
            {fullyBooked ? t('memories', 'sameDatesFullyBooked') : t('memories', 'sameDatesTitle')}
          </h2>

          {!fullyBooked ? (
            <ul className="mt-4 flex flex-wrap justify-center gap-2">
              {dates.map((date) => (
                <li key={date}>
                  <Link
                    href={`/charters/view/${memory.charter.id}?date=${date}`}
                    className="block rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
                  >
                    {formatDate(date, 'short')}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {discount > 0 && !fullyBooked ? (
            <p className="mt-3 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">
              {t('memories', 'loyaltyBadge', { percent: String(discount) })}
            </p>
          ) : null}

          <p className="mt-4 max-w-xs text-white/80">
            {fullyBooked
              ? t('memories', 'sameDatesFullyBookedMessage', { name: String(scene.name) })
              : t('memories', 'sameDatesCaptainMessage', { name: String(scene.name) })}
          </p>

          <Link
            href={`/charters/view/${memory.charter.id}`}
            className="mt-4 text-sm font-semibold text-white/70 underline"
          >
            {t('memories', 'viewFullCalendar')}
          </Link>
        </>
      );
    }

    case 'similar': {
      const charters = scene.charters as {
        id: string;
        title: string;
        photo: { placeholder: string; altText: string } | null;
      }[];

      return (
        <>
          <h2 className="text-2xl font-bold">{t('memories', 'similarTitle')}</h2>
          <p className="mt-1 text-white/80">
            {t('memories', 'similarBody', { destination: String(scene.destination) })}
          </p>

          <ul className="mt-4 grid w-full max-w-sm grid-cols-2 gap-3">
            {charters.map((charter) => (
              <li key={charter.id}>
                <Link href={`/charters/view/${charter.id}`} className="block">
                  <PhotoFrame
                    photo={charter.photo}
                    rounded="rounded-xl"
                    className="aspect-[4/3] w-full"
                  />
                  <span className="mt-1.5 block truncate text-left text-xs font-semibold text-white">
                    {charter.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      );
    }

    case 'outro':
      return (
        <>
          <span className="text-5xl" aria-hidden>
            🚤
          </span>
          <h2 className="mt-4 max-w-xs text-3xl font-bold">{t('memories', 'outroTitle')}</h2>
          <Link
            href={`/charters/view/${String(scene.charterId)}`}
            className="mt-6 rounded-full bg-accent px-8 py-3 text-base font-bold text-white"
          >
            {t('memories', 'outroCta')}
          </Link>
          <Link href="/" className="mt-3 text-sm font-semibold text-white/70 underline">
            {t('memories', 'returnHome')}
          </Link>
        </>
      );

    default:
      return null;
  }
}
