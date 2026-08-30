import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { formatDate, formatDuration, formatTime } from '@/lib/core/dates';
import { formatMoney } from '@/lib/core/money';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { expandBooking } from '@/lib/services/bookings';
import { Icon } from '@/components/ui/Icon';
import { Badge, Divider, LinkButton, PhotoFrame } from '@/components/ui/primitives';
import { BookingActions } from '@/components/account/BookingActions';
import { ChangeRequestPanel } from '@/components/booking/ChangeBookingFlow';
import { BalanceCollection } from '@/components/payments/BalanceFlow';

export const metadata: Metadata = { title: t('bookings', 'viewDetails') };

/**
 * Booking detail.
 *
 * The reference screen for a trip: everything a guest needs on the day, plus
 * the receipt breakdown and the actions still available on this booking.
 */
export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;

  const db = await getDb();
  const record = db.bookings.find((b) => b.id === id || b.reference === id);
  if (!record || record.customerId !== user.id) notFound();

  const booking = expandBooking(db, record);
  const duration = booking.package ? formatDuration(booking.package.hours) : null;
  const confirmed = booking.status === 'confirmed' || booking.status === 'accepted' || booking.status === 'done';

  const statusTone =
    booking.status === 'confirmed' ? 'success'
    : booking.status === 'pending' ? 'brand'
    : booking.status === 'done' ? 'neutral'
    : 'danger';

  const statusLabel =
    booking.status === 'confirmed' ? 'statusConfirmed'
    : booking.status === 'pending' ? 'statusPending'
    : booking.status === 'done' ? 'statusCompleted'
    : booking.status === 'declined' ? 'statusDeclined'
    : booking.status === 'withdrawn' ? 'statusExpired'
    : 'statusCancelled';

  return (
    <div className="max-w-2xl">
      <Link
        href="/account/bookings"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Icon name="chevron-left" size={15} />
        {t('bookings', 'title')}
      </Link>

      <header className="rounded-card border border-line bg-white p-4 shadow-card">
        <div className="flex gap-3">
          <PhotoFrame photo={booking.charter?.photo ?? null} rounded="rounded-lg" className="h-24 w-28 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold text-ink">
              <Link href={`/charters/view/${booking.charterId}`} className="hover:underline">
                {booking.charter?.title}
              </Link>
            </h1>
            <p className="text-sm text-ink-muted">{booking.charter?.destinationTitle}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone}>{t('bookings', statusLabel)}</Badge>
              <span className="font-mono text-xs text-ink-muted">{booking.reference}</span>
            </p>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- trip info */}
      <section className="mt-4 rounded-card border border-line bg-white p-4 shadow-card">
        <h2 className="mb-3 text-base font-bold text-ink">{t('booking', 'yourTrip')}</h2>
        <dl className="space-y-2 text-sm">
          <Row label={t('packageCard', 'tripDetails')} value={booking.package?.title ?? ''} />
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
          <Row
            label={t('booking', 'guests')}
            value={`${booking.adults} ${booking.adults === 1 ? 'adult' : 'adults'}${
              booking.children ? `, ${booking.children} ${booking.children === 1 ? 'child' : 'children'}` : ''
            }`}
          />
          <Row
            label={t('packageCard', 'privateCharter')}
            value={booking.package?.type === 'shared' ? t('search', 'perPerson') : t('packageCard', 'privateCharter')}
          />
          <Row label={t('bookings', 'bookedOn')} value={formatDate(booking.createdAt.slice(0, 10), 'medium')} />
        </dl>

        <Divider className="my-4" />

        <h2 className="mb-2 text-base font-bold text-ink">{t('bookings', 'meetingPoint')}</h2>
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <Icon name="map-pin" size={15} className="mt-0.5 shrink-0 text-ink-muted" />
          <span>
            {confirmed && booking.charter?.address
              ? `${booking.charter.address}, ${booking.charter.destinationTitle}`
              : booking.charter?.destinationTitle}
            {!confirmed ? (
              <span className="mt-0.5 block text-xs text-ink-muted">
                {t('viewCharter', 'exactAddressAfterBooking')}
              </span>
            ) : null}
          </span>
        </p>
        {confirmed && booking.charter?.directions ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{booking.charter.directions}</p>
        ) : null}

        {confirmed && booking.owner ? (
          <>
            <Divider className="my-4" />
            <h2 className="mb-2 text-base font-bold text-ink">{t('bookings', 'ownerContact')}</h2>
            <p className="text-sm text-ink-soft">{booking.owner.displayName}</p>
            {booking.owner.phone ? (
              <a
                href={`tel:${booking.owner.phone.replace(/\s/g, '')}`}
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
              >
                <Icon name="phone" size={14} />
                {booking.owner.phone}
              </a>
            ) : null}
          </>
        ) : null}
      </section>

      {/* ------------------------------------------------------ receipt */}
      <section className="mt-4 rounded-card border border-line bg-white p-4 shadow-card">
        <h2 className="mb-3 text-base font-bold text-ink">{t('booking', 'priceDetails')}</h2>
        <ul className="space-y-1.5 text-sm">
          {booking.breakdown.lines
            .filter((line) => !line.informational)
            .map((line) => (
              <li key={line.key} className="flex items-baseline justify-between gap-3">
                <span className={line.amount < 0 ? 'text-success' : 'text-ink-soft'}>
                  {lineLabel(line.key)}
                </span>
                <span className={`shrink-0 tabular-nums ${line.amount < 0 ? 'font-semibold text-success' : 'text-ink'}`}>
                  {line.amount < 0 ? '−' : ''}
                  {formatMoney(Math.abs(line.amount), booking.currency)}
                </span>
              </li>
            ))}
        </ul>

        <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
          <span className="text-sm font-bold text-ink">{t('packageCard', 'total')}</span>
          <span className="text-lg font-extrabold tabular-nums text-ink">
            {formatMoney(booking.breakdown.total, booking.currency)}
          </span>
        </div>

        <dl className="mt-3 space-y-1 rounded-control bg-surface-sunken p-3 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">{t('bookings', 'paidOnline')}</dt>
            <dd className="tabular-nums text-ink">
              {formatMoney(booking.breakdown.dueNow, booking.currency)}
            </dd>
          </div>
          {booking.breakdown.dueOnArrival > 0 ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">{t('bookings', 'dueOnArrival')}</dt>
              <dd className="tabular-nums text-ink">
                {formatMoney(booking.breakdown.dueOnArrival, booking.currency)}
              </dd>
            </div>
          ) : null}
          {booking.breakdown.securityDeposit > 0 ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">{t('packageCard', 'securityDeposit')}</dt>
              <dd className="tabular-nums text-ink">
                {formatMoney(booking.breakdown.securityDeposit, booking.currency)}
              </dd>
            </div>
          ) : null}
          {booking.refundAmount !== undefined ? (
            <div className="flex justify-between gap-2 border-t border-line pt-1">
              <dt className="font-semibold text-success">{t('bookings', 'refundIssued')}</dt>
              <dd className="tabular-nums font-semibold text-success">
                {formatMoney(booking.refundAmount, booking.currency)}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* ------------------------------------------------ cancellation */}
      <section className="mt-4 rounded-card border border-line bg-white p-4 shadow-card">
        <h2 className="mb-1.5 text-base font-bold text-ink">{t('booking', 'cancellationTitle')}</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          {booking.charter && booking.charter.policies.freeCancellationDaysInAdvance > 0
            ? t('viewCharter', 'cancellationDaysNotice', {
                count: booking.charter.policies.freeCancellationDaysInAdvance,
                p: booking.charter.policies.freeCancellationDaysInAdvance,
              })
            : t('viewCharter', 'cancellationDepositNonRefundable')}
        </p>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        {booking.threadId ? (
          <LinkButton href={`/account/inbox/${booking.threadId}`} variant="outline" icon="message">
            {t('bookings', 'messageOwner')}
          </LinkButton>
        ) : null}
        {booking.canReview ? (
          <LinkButton href="/account/reviews" icon="star-empty">
            {t('bookings', 'leaveReview')}
          </LinkButton>
        ) : null}
        {/* Only meaningful once the trip is actually on. */}
        {(booking.status === 'confirmed' || booking.status === 'accepted') &&
        booking.balance.outstanding > 0 ? (
          <BalanceCollection
            bookingId={booking.id}
            mode={booking.balance.mode}
            outstanding={booking.balance.outstanding}
            currency={booking.currency}
            scheduledFor={booking.balance.scheduledFor}
          />
        ) : null}

        {booking.changeRequest ? (
          <ChangeRequestPanel
            bookingId={booking.id}
            role="customer"
            currency={booking.currency}
            request={{
              id: booking.changeRequest.id,
              requestedBy: booking.changeRequest.requestedBy,
              note: booking.changeRequest.note,
              priceDifference: booking.changeRequest.priceDifference,
              expiresAt: booking.changeRequest.expiresAt,
              original: booking.changeRequest.original,
              requested: booking.changeRequest.requested,
            }}
          />
        ) : null}

        <BookingActions
          bookingId={booking.id}
          role="customer"
          canCancel={booking.canCancel}
          canRequestChange={booking.canRequestChange}
        />
      </div>
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

function lineLabel(key: string): string {
  const map: Record<string, string> = {
    base: t('packageCard', 'tripPrice'),
    additional_guests: t('packageCard', 'additionalGuests', { count: '' }).replace(' ()', ''),
    service_fee: t('packageCard', 'serviceFee'),
    processing_fee: t('packageCard', 'processingFee'),
    loyalty: t('packageCard', 'youSave', { amount: '' }).trim(),
    promo: t('booking', 'promoApplied'),
    credit: t('booking', 'creditApplied'),
  };
  return map[key] ?? key;
}
