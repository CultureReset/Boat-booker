import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { commerceConfig } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { formatDate, formatDuration, formatTime } from '@/lib/core/dates';
import { formatMoney } from '@/lib/core/money';
import { getDb } from '@/lib/storage';
import { currentUser } from '@/lib/auth/session';
import { expandBooking } from '@/lib/services/bookings';
import { Icon } from '@/components/ui/Icon';
import { Badge, LinkButton, PhotoFrame } from '@/components/ui/primitives';
import { AddToCalendar } from '@/components/booking/AddToCalendar';

export const metadata: Metadata = {
  title: t('booking', 'confirmedTitle'),
  robots: { index: false, follow: false },
};

/**
 * Booking confirmation.
 *
 * The page a guest screenshots, so it carries everything they will want on the
 * day: reference, date and departure time, meeting point, what was paid and
 * what is still due, and a direct line to the owner.
 */
export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const viewer = await currentUser();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/book/confirmation/${id}`)}`);

  const db = await getDb();
  const record = db.bookings.find((b) => b.id === id || b.reference === id);
  if (!record) notFound();
  // A booking is visible to its guest and to the owner, and to nobody else.
  if (record.customerId !== viewer.id && record.ownerId !== viewer.id) notFound();

  const booking = expandBooking(db, record);
  const pkg = booking.package;
  const duration = pkg ? formatDuration(pkg.hours) : null;
  const confirmed = booking.status === 'confirmed';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-card border border-line bg-white p-6 text-center shadow-card">
        <span
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            confirmed ? 'bg-emerald-50 text-success' : 'bg-brand-50 text-brand-700'
          }`}
        >
          <Icon name={confirmed ? 'check-circle' : 'clock'} size={28} />
        </span>

        <h1 className="mt-4 text-xl font-extrabold text-ink md:text-2xl">
          {confirmed ? t('booking', 'confirmedTitle') : t('booking', 'requestedTitle')}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {confirmed
            ? t('booking', 'confirmedBody', { email: booking.contact.email })
            : t('booking', 'requestedBody', {
                owner: booking.owner?.displayName ?? '',
                hours: commerceConfig.inquiryResponseWindowHours,
              })}
        </p>

        <p className="mt-4 inline-flex items-center gap-2 rounded-control bg-surface-sunken px-3 py-2">
          <span className="text-xs text-ink-muted">{t('booking', 'referenceNumber')}</span>
          <span className="font-mono text-sm font-bold tracking-wide text-ink">{booking.reference}</span>
        </p>
      </div>

      {/* --------------------------------------------------- trip card */}
      <section className="mt-4 rounded-card border border-line bg-white p-4 shadow-card">
        <div className="flex gap-3">
          <PhotoFrame photo={booking.charter?.photo ?? null} rounded="rounded-lg" className="h-20 w-24 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-ink">
              <Link href={`/charters/view/${booking.charterId}`} className="hover:underline">
                {booking.charter?.title}
              </Link>
            </h2>
            <p className="text-sm text-ink-muted">{booking.charter?.destinationTitle}</p>
            <p className="mt-1">
              <Badge tone={confirmed ? 'success' : 'brand'}>
                {confirmed ? t('bookings', 'statusConfirmed') : t('bookings', 'statusPending')}
              </Badge>
            </p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <Row label={t('packageCard', 'tripDetails')} value={pkg?.title ?? ''} />
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
        </dl>

        {/* Meeting point — the exact address is released once confirmed. */}
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="mb-1.5 text-sm font-bold text-ink">{t('bookings', 'meetingPoint')}</h3>
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
        </div>

        {/* ------------------------------------------------- payment */}
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="mb-2 text-sm font-bold text-ink">{t('booking', 'priceDetails')}</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-soft">{t('packageCard', 'total')}</dt>
              <dd className="font-bold tabular-nums text-ink">
                {formatMoney(booking.breakdown.total, booking.currency)}
              </dd>
            </div>
            {booking.breakdown.dueNow > 0 ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">{t('bookings', 'paidOnline')}</dt>
                <dd className="tabular-nums text-ink-muted">
                  {formatMoney(booking.breakdown.dueNow, booking.currency)}
                </dd>
              </div>
            ) : null}
            {booking.breakdown.dueOnArrival > 0 ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">{t('bookings', 'dueOnArrival')}</dt>
                <dd className="tabular-nums text-ink-muted">
                  {formatMoney(booking.breakdown.dueOnArrival, booking.currency)}
                </dd>
              </div>
            ) : null}
            {booking.breakdown.securityDeposit > 0 ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">{t('packageCard', 'securityDeposit')}</dt>
                <dd className="tabular-nums text-ink-muted">
                  {formatMoney(booking.breakdown.securityDeposit, booking.currency)}
                </dd>
              </div>
            ) : null}
          </dl>

          {booking.freeCancellationUntil ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
              <Icon name="check-circle" size={13} />
              {t('bookings', 'freeCancellationUntil', {
                date: formatDate(booking.freeCancellationUntil, 'medium'),
              })}
            </p>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------ actions */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <LinkButton href={`/account/bookings/${booking.id}`} size="lg" iconRight="arrow-right">
          {t('booking', 'viewBooking')}
        </LinkButton>
        <AddToCalendar
          title={`${booking.charter?.title ?? 'Boat trip'} — ${booking.reference}`}
          date={booking.date}
          time={booking.departureTime}
          durationHours={pkg?.hours ?? 4}
          location={booking.charter?.destinationTitle ?? ''}
          description={`${pkg?.title ?? ''} · ${booking.reference}`}
        />
      </div>

      {booking.threadId ? (
        <Link
          href={`/account/inbox/${booking.threadId}`}
          className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-brand-700 hover:underline"
        >
          <Icon name="message" size={15} />
          {t('bookings', 'messageOwner')}
        </Link>
      ) : null}

      <p className="mt-6 text-center">
        <Link href="/" className="text-sm text-ink-muted hover:underline">
          {t('booking', 'backToHome')}
        </Link>
      </p>
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
