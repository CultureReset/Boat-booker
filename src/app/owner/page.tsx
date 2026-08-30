import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { formatDate, formatTime } from '@/lib/core/dates';
import { formatMoney } from '@/lib/core/money';
import { currentUser } from '@/lib/auth/session';
import { getDb, mutate } from '@/lib/storage';
import { settleElapsedBookings } from '@/lib/services/bookings';
import { ownerDashboard } from '@/lib/services/owner';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Badge, EmptyState, LinkButton, PhotoFrame } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

export const metadata: Metadata = { title: t('owner', 'dashboard') };

/**
 * Owner dashboard.
 *
 * Built around one question: what does this operator need to do right now.
 * The attention list comes first, then today's departures, then the numbers —
 * KPIs are context, not the job.
 */
export default async function OwnerDashboardPage() {
  const user = (await currentUser())!;

  await mutate((db) => settleElapsedBookings(db));
  const db = await getDb();
  const dashboard = ownerDashboard(db, user);

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'goodMorning' : hour < 18 ? 'goodAfternoon' : 'goodEvening';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-extrabold text-ink md:text-2xl">
          {t('owner', greetingKey, { name: user.firstName })}
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">{user.ownerProfile?.companyName}</p>
      </header>

      {/* -------------------------------------------- needs attention */}
      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="mb-3 text-base font-bold text-ink">
          {t('owner', 'needsAttention')}
        </h2>

        {dashboard.needsAttention.length === 0 ? (
          <p className="flex items-center gap-2 rounded-card border border-line bg-white p-4 text-sm text-ink-muted">
            <Icon name="check-circle" size={18} className="text-success" />
            {t('owner', 'nothingNeedsAttention')}
          </p>
        ) : (
          <ul className="space-y-2">
            {dashboard.needsAttention.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cx(
                    'flex items-center gap-3 rounded-card border bg-white p-3 transition-colors hover:shadow-card',
                    item.severity === 'high'
                      ? 'border-l-4 border-l-danger border-line'
                      : item.severity === 'medium'
                        ? 'border-l-4 border-l-warning border-line'
                        : 'border-line',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      item.severity === 'high'
                        ? 'bg-red-50 text-danger'
                        : item.severity === 'medium'
                          ? 'bg-amber-50 text-warning'
                          : 'bg-surface-sunken text-ink-muted',
                    )}
                  >
                    <Icon name={item.severity === 'low' ? 'info' : 'alert'} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">{item.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{item.body}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-brand-700">{item.cta}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------ today's trips */}
      <section aria-labelledby="today-heading">
        <h2 id="today-heading" className="mb-3 text-base font-bold text-ink">
          {t('owner', 'todaysTrips')}
        </h2>
        {dashboard.todaysTrips.length === 0 ? (
          <p className="rounded-card border border-line bg-white p-4 text-sm text-ink-muted">
            {t('owner', 'noTripsToday')}
          </p>
        ) : (
          <ul className="space-y-2">
            {dashboard.todaysTrips.map((trip) => (
              <li key={trip.id}>
                <TripRow trip={trip} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------- stats */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="mb-3 text-base font-bold text-ink">
          {t('owner', 'dashboard')}
        </h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon="calendar"
            label={t('owner', 'statsUpcomingTrips')}
            value={String(dashboard.stats.upcomingTrips)}
          />
          <Stat
            icon="clock"
            label={t('owner', 'statsPendingRequests')}
            value={String(dashboard.stats.pendingRequests)}
            tone={dashboard.stats.pendingRequests > 0 ? 'warning' : undefined}
          />
          <Stat
            icon="wallet"
            label={t('owner', 'statsEarningsThisMonth')}
            value={formatMoney(dashboard.stats.earningsThisMonth, dashboard.stats.currency)}
          />
          <Stat
            icon="chart"
            label={t('owner', 'statsOccupancy')}
            value={`${dashboard.stats.occupancyPercent}%`}
          />
          <Stat
            icon="message"
            label={t('owner', 'statsUnreadMessages')}
            value={String(dashboard.stats.unreadMessages)}
            tone={dashboard.stats.unreadMessages > 0 ? 'warning' : undefined}
          />
          <Stat
            icon="star"
            label={t('owner', 'statsAverageRating')}
            value={
              dashboard.stats.reviewCount > 0
                ? `${dashboard.stats.averageRating.toFixed(1)} (${dashboard.stats.reviewCount})`
                : '—'
            }
          />
          <Stat
            icon="bolt"
            label={t('owner', 'statsResponseRate')}
            value={`${dashboard.stats.responseRate}%`}
          />
          <Stat
            icon="eye"
            label={t('owner', 'statsViewsThisWeek')}
            value={dashboard.stats.viewsThisWeek.toLocaleString('en-US')}
          />
        </dl>
      </section>

      {/* -------------------------------------------- pending requests */}
      {dashboard.pendingRequests.length ? (
        <section aria-labelledby="pending-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 id="pending-heading" className="text-base font-bold text-ink">
              {t('owner', 'statsPendingRequests')}
            </h2>
            <Link href="/owner/bookings?status=pending" className="text-sm font-semibold text-brand-700 hover:underline">
              {t('general', 'seeAll')}
            </Link>
          </div>
          <ul className="space-y-2">
            {dashboard.pendingRequests.slice(0, 3).map((trip) => (
              <li key={trip.id}>
                <TripRow trip={trip} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------ upcoming */}
      <section aria-labelledby="upcoming-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="upcoming-heading" className="text-base font-bold text-ink">
            {t('owner', 'statsUpcomingTrips')}
          </h2>
          <Link href="/owner/bookings" className="text-sm font-semibold text-brand-700 hover:underline">
            {t('general', 'seeAll')}
          </Link>
        </div>

        {dashboard.upcomingTrips.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={t('owner', 'bookingsEmpty')}
            action={<LinkButton href="/owner/listings">{t('navigation', 'listings')}</LinkButton>}
          />
        ) : (
          <ul className="space-y-2">
            {dashboard.upcomingTrips.map((trip) => (
              <li key={trip.id}>
                <TripRow trip={trip} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface TripSummary {
  id: string;
  reference: string;
  status: string;
  date: string;
  departureTime: string;
  adults: number;
  children: number;
  total: number;
  currency: string;
  charterTitle: string;
  packageTitle: string;
  customerName: string;
  photo: { placeholder: string; altText: string } | null;
  respondByAt?: string;
}

function TripRow({ trip }: { trip: TripSummary }) {
  return (
    <Link
      href={`/owner/bookings/${trip.id}`}
      className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition-shadow hover:shadow-card"
    >
      <PhotoFrame photo={trip.photo} rounded="rounded-lg" className="h-14 w-16 shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{trip.charterTitle}</p>
        <p className="truncate text-xs text-ink-muted">
          {trip.customerName} · {trip.packageTitle}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-ink-soft">
          <span className="flex items-center gap-1">
            <Icon name="calendar" size={11} />
            {formatDate(trip.date, 'short')}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="clock" size={11} />
            {formatTime(trip.departureTime)}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="users" size={11} />
            {trip.adults + trip.children}
          </span>
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-ink">{formatMoney(trip.total, trip.currency)}</p>
        {trip.status === 'pending' ? (
          <Badge tone="warning">{t('bookings', 'statusPending')}</Badge>
        ) : (
          <Badge tone="success">{t('bookings', 'statusConfirmed')}</Badge>
        )}
      </div>
    </Link>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  tone?: 'warning';
}) {
  return (
    <div className="rounded-card border border-line bg-white p-3">
      <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
        <Icon name={icon} size={13} />
        <span className="truncate">{label}</span>
      </dt>
      <dd className={cx('mt-1 text-xl font-extrabold tabular-nums', tone === 'warning' ? 'text-warning' : 'text-ink')}>
        {value}
      </dd>
    </div>
  );
}
