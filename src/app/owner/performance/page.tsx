import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { formatMoney } from '@/lib/core/money';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { awardCriteria, performanceFor, type Period } from '@/lib/services/performance';
import { Icon } from '@/components/ui/Icon';
import { Badge, SectionHeading } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

export const metadata: Metadata = { title: t('performance', 'title') };

const PERIODS: { key: Period; labelKey: string }[] = [
  { key: 'last_4_weeks', labelKey: 'last4Weeks' },
  { key: 'last_12_months', labelKey: 'last12Months' },
  { key: 'this_year', labelKey: 'thisYear' },
];

/**
 * Performance.
 *
 * Ratios lead and counts support them, because a booking count in isolation
 * tells an operator nothing about whether their season is going well — the
 * same count against last year tells them everything.
 */
export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; listing?: string }>;
}) {
  const { period, listing } = await searchParams;
  const active: Period = PERIODS.some((p) => p.key === period) ? (period as Period) : 'last_4_weeks';

  const user = (await currentUser())!;
  const db = await getDb();

  const listings = db.charters
    .filter((c) => c.ownerId === user.id)
    .map((c) => ({ id: c.id, title: c.title }));

  const report = performanceFor(db, user.id, { period: active, charterId: listing ?? null });
  const criteria = awardCriteria(report.award);
  const currency = db.charters.find((c) => c.ownerId === user.id)?.currency ?? 'USD';

  const format = (metric: (typeof report.metrics)[number]) => {
    switch (metric.kind) {
      case 'percent':
        return `${Math.round(metric.value * 100)}%`;
      case 'rating':
        return metric.value ? metric.value.toFixed(2) : '—';
      case 'money':
        return formatMoney(metric.value, currency);
      default:
        return metric.value.toLocaleString();
    }
  };

  return (
    <>
      <SectionHeading
        title={t('performance', 'title')}
        subtitle={t('performance', 'subtitle')}
        level={1}
      />

      {/* Filters */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PERIODS.map((option) => (
          <Link
            key={option.key}
            href={`/owner/performance?period=${option.key}${listing ? `&listing=${listing}` : ''}`}
            className={cx(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              active === option.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-line bg-white text-ink-soft hover:bg-surface-sunken',
            )}
          >
            {t('performance', option.labelKey)}
          </Link>
        ))}
      </div>

      {listings.length > 1 ? (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={`/owner/performance?period=${active}`}
            className={cx(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              !listing ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft',
            )}
          >
            {t('performance', 'allListings')}
          </Link>
          {listings.map((option) => (
            <Link
              key={option.id}
              href={`/owner/performance?period=${active}&listing=${option.id}`}
              className={cx(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                listing === option.id
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-white text-ink-soft hover:bg-surface-sunken',
              )}
            >
              {option.title}
            </Link>
          ))}
        </div>
      ) : null}

      {report.sparse ? (
        <p className="mb-4 rounded-card border border-line bg-white p-4 text-sm text-ink-muted">
          {t('performance', 'notEnoughData')}
        </p>
      ) : null}

      {/* Metrics */}
      {/* Two up even on the narrowest phone, matching the dashboard tiles — a
          single column turns eight metrics into eight screens of scrolling. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {report.metrics.map((metric) => (
          <div key={metric.key} className="rounded-card border border-line bg-white p-4">
            <p className="text-xs font-semibold text-ink-muted">
              {t('performance', metric.key)}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{format(metric)}</p>

            {metric.changePercent === undefined ? null : metric.changePercent === 0 ? (
              <p className="mt-0.5 text-xs text-ink-faint">{t('performance', 'noChangeYoY')}</p>
            ) : (
              <p
                className={cx(
                  'mt-0.5 flex items-center gap-1 text-xs font-semibold',
                  metric.changePercent > 0 ? 'text-success' : 'text-danger',
                )}
              >
                <Icon
                  name={metric.changePercent > 0 ? 'chevron-up' : 'chevron-down'}
                  size={12}
                />
                {t('performance', metric.changePercent > 0 ? 'upYoY' : 'downYoY', {
                  percent: String(Math.abs(metric.changePercent)),
                })}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-ink-faint">{t('performance', 'statsDelay')}</p>

      {/* Award */}
      <section className="mt-6 rounded-card border border-line bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink">{t('performance', 'awardTitle')}</h2>
            <p className="text-xs text-ink-muted">{t('performance', 'awardIntro')}</p>
          </div>
          {report.award.hasAward ? (
            <Badge tone="gold">
              <Icon name="star" size={12} />
              {report.award.awardedYear}
            </Badge>
          ) : null}
        </div>

        <p className="mt-2 text-sm font-semibold text-ink">
          {report.award.hasAward
            ? t('performance', 'awardHas', { year: String(report.award.awardedYear ?? '') })
            : criteria.filter((c) => c.met).length >= 3
              ? t('performance', 'awardOnTrack')
              : t('performance', 'awardNotYet')}
        </p>

        <ul className="mt-3 space-y-2">
          {criteria.map((criterion) => {
            const value =
              criterion.kind === 'percent'
                ? `${Math.round(criterion.value * 100)}%`
                : criterion.kind === 'rating'
                  ? criterion.value.toFixed(2)
                  : criterion.kind === 'boolean'
                    ? t('performance', criterion.met ? 'criterionMet' : 'criterionNotMet')
                    : String(criterion.value);

            const target =
              criterion.kind === 'percent'
                ? `${Math.round(criterion.target * 100)}%`
                : criterion.kind === 'rating'
                  ? criterion.target.toFixed(1)
                  : criterion.kind === 'boolean'
                    ? ''
                    : String(criterion.target);

            // The bar is capped at 100% so an operator well past a threshold
            // sees "met", not a bar overflowing its track.
            const progress = Math.min(1, criterion.target ? criterion.value / criterion.target : 0);

            return (
              <li key={criterion.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-ink">
                    {t('performance', criterion.key)}
                  </span>
                  <span
                    className={cx(
                      'text-xs font-bold tabular-nums',
                      criterion.met ? 'text-success' : 'text-ink-muted',
                    )}
                  >
                    {target
                      ? t('performance', 'ofTarget', { value, target })
                      : value}
                  </span>
                </div>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-line">
                  <span
                    className={cx(
                      'block h-full rounded-full',
                      criterion.met ? 'bg-success' : 'bg-brand-400',
                    )}
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
