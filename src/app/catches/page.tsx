import Link from 'next/link';
import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { timeAgo } from '@/lib/core/dates';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { browseCatches, type Season } from '@/lib/services/memories';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, PhotoFrame, SectionHeading } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

export const metadata: Metadata = {
  title: t('catches', 'metaTitle'),
  description: t('catches', 'subtitle'),
};

const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];

/**
 * The public catches feed.
 *
 * Server-rendered and indexable — it is one of the few pages on the site with
 * genuinely fresh content, and it is the reason someone who has never booked
 * arrives at all. The sign-in nudge appears after a screenful rather than in
 * front of the content, so the page is worth landing on either way.
 */
export default async function CatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; q?: string; page?: string }>;
}) {
  const { season, q, page } = await searchParams;
  const activeSeason = SEASONS.includes(season as Season) ? (season as Season) : undefined;

  const db = await getDb();
  const viewer = await currentUser();

  const perPage = viewer ? 24 : 12;
  const result = browseCatches(db, {
    season: activeSeason,
    q,
    page: Number(page) || 1,
    perPage,
  });

  const href = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (next.season) params.set('season', next.season);
    if (q) params.set('q', q);
    return `/catches${params.size ? `?${params}` : ''}`;
  };

  return (
    <div className="mx-auto w-full max-w-shell px-4 py-6">
      <SectionHeading title={t('catches', 'title')} subtitle={t('catches', 'subtitle')} level={1} />

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href={href({})}
          className={cx(
            'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
            !activeSeason
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-line bg-white text-ink-soft hover:bg-surface-sunken',
          )}
        >
          {t('catches', 'allMonths')}
        </Link>
        {SEASONS.map((option) => (
          <Link
            key={option}
            href={href({ season: option })}
            className={cx(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              activeSeason === option
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-line bg-white text-ink-soft hover:bg-surface-sunken',
            )}
          >
            {t('catches', option)}
          </Link>
        ))}
      </div>

      {result.catches.length === 0 ? (
        <EmptyState
          icon="camera"
          title={t('catches', 'noResults')}
          body={t('catches', 'noResultsBody')}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.catches.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-card border border-line bg-white">
              <Link href={`/charters/view/${item.charterId}`} className="block">
                <PhotoFrame photo={item.photo} rounded="rounded-none" className="aspect-square w-full" />
              </Link>
              <div className="p-3">
                <p className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/charters/view/${item.charterId}`}
                    className="min-w-0 truncate text-sm font-bold text-ink hover:underline"
                  >
                    {item.charterTitle}
                  </Link>
                  <span className="shrink-0 text-[11px] text-ink-faint">
                    {timeAgo(item.createdAt)}
                  </span>
                </p>
                <p className="text-xs text-ink-muted">{item.destination}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{item.caption}</p>
                <p className="mt-2 flex items-center gap-3 text-xs text-ink-faint">
                  <span className="flex items-center gap-1">
                    <Icon name="heart" size={13} />
                    {item.likes}
                  </span>
                  <span>{item.customerName}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!viewer && result.totalCount > perPage ? (
        <div className="mt-6 rounded-card border border-line bg-white p-6 text-center">
          <h2 className="text-base font-bold text-ink">{t('catches', 'signInTitle')}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {t('catches', 'signInBody', { brand: brand.name })}
          </p>
          <Link
            href="/login?next=/catches"
            className="mt-3 inline-block rounded-control bg-accent px-6 py-2.5 text-sm font-bold text-white"
          >
            {t('login', 'login')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
