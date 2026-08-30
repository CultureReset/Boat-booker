import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { formatDate, formatDuration, formatTime } from '@/lib/core/dates';
import { formatMoney } from '@/lib/core/money';
import { commerceConfig } from '@/config/brand';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { expandBooking } from '@/lib/services/bookings';
import { Icon } from '@/components/ui/Icon';
import { Badge, LinkButton, PhotoFrame } from '@/components/ui/primitives';
import { OwnerBookingActions } from '@/components/owner/OwnerBookingActions';

export const metadata: Metadata = { title: t('bookings', 'viewDetails') };

/**
 * Owner's view of one booking.
 *
 * Carries what the operator needs on the day — who is coming, how many, when
 * they arrive, how to reach them — plus the payout maths for this trip.
 */
export default async function OwnerBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;

  const db = await getDb();
  const record = db.bookings.find((b) => b.id === id || b.reference === id);
  if (!record || record.ownerId !== user.id) notFound();

  const booking = expandBooking(db, record);
  const payout = db.payouts.find((p) => p.bookingId === record.id);
  const duration = booking.package ? formatDuration(booking.package.hours) : null;

  const statusTone =
    booking.status === 'confirmed' ? 'success'
    : booking.status === 'pending' ? 'warning'
    : booking.status === 'done' ? 'neutral'
    : 'danger';

  return (
    <div className="max-w-2xl">
      <Link
        href="/owner/bookings"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Icon name="chevron-left" size={15} />
        {t('owner', 'bookingsTitle')}
      </Link>

      <header className="rounded-card border border-line bg-white p-4 shadow-card">
        <div className="flex gap-3">
          <PhotoFrame photo={booking.charter?.photo ?? null} rounded="rounded-lg" className="h-24 w-28 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold text-ink">{booking.charter?.title}</h1>
            <p className="text-sm text-ink-muted">{booking.package?.title}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone}>
                {t('bookings', `status${booking.status.charAt(0).toUpperCase()}${booking.status.slice(1)}`)}
              </Badge>
              <span className="font-mono text-xs text-ink-muted">{booking.reference}</span>
            </p>
          </div>
        </div>

        {booking.status === 'pending' && booking.respondByAt ? (
          <p className="mt-3 flex items-center gap-2 rounded-control bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Icon name="clock" size={16} />
            {t('booking', 'requestNotice', { hours: commerceConfig.inquiryResponseWindowHours })}
          </p>
        ) : null}

        <OwnerBookingActions
          bookingId={booking.id}
          status={booking.status}
          threadId={booking.threadId}
        />
      </header>

      {/* -------------------------------------------------------- guest */}
      <section className="mt-4 rounded-card border border-line bg-white p-4 shadow-card">
        <h2 className="mb-3 text-base font-bold text-ink">{t('booking', 'contactDetails')}</h2>
        <dl className="space-y-2 text-sm">
          <Row label={t('login', 'firstName')} value={`${booking.contact.firstName} ${booking.contact.lastName}`} />
          <Row label={t('login', 'email')} value={booking.contact.email} />
          {booking.contact.phone ? <Row label={t('login', 'phone')} value={booking.contact.phone} /> : null}
          <Row
            label={t('booking', 'guests')}
            value={`${booking.adults} ${booking.adults === 1 ? 'adult' : 'adults'}${
              booking.children ? `, ${booking.children} ${booking.children === 1 ? 'child' : 'children'}` : ''
            }`}
          />
        </dl>

        {booking.messageToOwner ? (
          <div className="mt-3 rounded-control border-l-2 border-brand-400 bg-surface-sunken px-3 py-2">
            <p className="text-xs font-bold text-ink">{t('booking', 'messageToOwner')}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{booking.messageToOwner}</p>
          </div>
        ) : null}
      </section>

      {/* --------------------------------------------------------- trip */}
      <section className="mt-4 rounded-card border border-line bg-white p-4 shadow-card">
        <h2 className="mb-3 text-base font-bold text-ink">{t('booking', 'yourTrip')}</h2>
        <dl className="space-y-2 text-sm">
          <Row label={t('booking', 'tripDate')} value={formatDate(booking.date, 'long')} />
          <Row label={t('booking', 'tripTime')} value={formatTime(booking.departureTime)} />
          {duration ? (
            <Row
              label={t('booking', 'tripDuration')}
              value={t('packageCard', duration.unit === 'hour' ? 'duration' : 'durationDays', {
                count: duration.count,
                p: duration.count,
              })}
            />
          ) : null}
          <Row label={t('bookings', 'bookedOn')} value={formatDate(booking.createdAt.slice(0, 10), 'medium')} />
        </dl>
      </section>

      {/* ------------------------------------------------------- payout */}
      <section className="mt-4 rounded-card border border-line bg-white p-4 shadow-card">
        <h2 className="mb-3 text-base font-bold text-ink">{t('owner', 'payoutsTitle')}</h2>
        <dl className="space-y-2 text-sm">
          <Row label={t('owner', 'grossEarnings')} value={formatMoney(booking.breakdown.total, booking.currency)} />
          {payout ? (
            <>
              <Row
                label={t('owner', 'platformFee', { percent: Math.round(commerceConfig.serviceFeeRate * 100) })}
                value={`− ${formatMoney(payout.platformFee, payout.currency)}`}
              />
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                <dt className="font-bold text-ink">{t('owner', 'netPayout')}</dt>
                <dd className="text-lg font-extrabold tabular-nums text-ink">
                  {formatMoney(payout.net, payout.currency)}
                </dd>
              </div>
              <Row
                label={payout.status === 'paid' ? t('owner', 'payoutsPaid') : t('owner', 'payoutsPending')}
                value={formatDate(payout.scheduledFor, 'medium')}
              />
            </>
          ) : (
            <p className="text-sm text-ink-muted">{t('owner', 'payoutsEmpty')}</p>
          )}
        </dl>

        {booking.breakdown.dueOnArrival > 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-control bg-surface-sunken px-3 py-2 text-xs text-ink-soft">
            <Icon name="info" size={14} className="mt-0.5 shrink-0" />
            {t('bookings', 'dueOnArrival')}: {formatMoney(booking.breakdown.dueOnArrival, booking.currency)}
          </p>
        ) : null}
      </section>

      {booking.threadId ? (
        <LinkButton href={`/owner/inbox/${booking.threadId}`} variant="outline" icon="message" className="mt-4">
          {t('inbox', 'title')}
        </LinkButton>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
