'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { formatDate, formatTime } from '@/lib/core/dates';
import { formatMoney } from '@/lib/core/money';
import { api, errorMessage } from '@/lib/client/api';
import type { ExpandedBooking } from '@/lib/services/bookings';
import type { BookingStatus } from '@/lib/domain/types';
import { useToast } from '@/components/providers/ToastProvider';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { Badge, Button, EmptyState, LinkButton, PhotoFrame } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Booking list.
 *
 * Shared by the customer's "My Bookings" and the owner's booking queue — the
 * two differ only in which actions are offered, which `role` decides. Status
 * filtering is a client-side tab set over the already-fetched list, because
 * the volumes involved never justify a round trip per tab.
 */

export type BookingRole = 'customer' | 'owner';

const STATUS_TONE: Record<BookingStatus, 'success' | 'brand' | 'neutral' | 'danger'> = {
  request: 'brand',
  pending: 'brand',
  confirmed: 'success',
  accepted: 'success',
  change_requested: 'brand',
  change_pending: 'brand',
  cancel_requested: 'danger',
  cancelled: 'danger',
  declined: 'danger',
  withdrawn: 'neutral',
  done: 'neutral',
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  request: 'statusRequest',
  pending: 'statusPending',
  confirmed: 'statusConfirmed',
  accepted: 'statusAccepted',
  change_requested: 'statusChangeRequested',
  change_pending: 'statusChangePending',
  cancel_requested: 'statusCancelRequested',
  cancelled: 'statusCancelled',
  declined: 'statusDeclined',
  withdrawn: 'statusWithdrawn',
  done: 'statusCompleted',
};

const TABS = [
  { key: 'upcoming', labelKey: 'upcoming' },
  { key: 'pending', labelKey: 'pending' },
  { key: 'done', labelKey: 'completed' },
  { key: 'cancelled', labelKey: 'cancelled' },
  { key: 'all', labelKey: 'all' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function BookingList({
  bookings: initial,
  role,
}: {
  bookings: ExpandedBooking[];
  role: BookingRole;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [bookings, setBookings] = useState(initial);
  const [tab, setTab] = useState<TabKey>('upcoming');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ExpandedBooking | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const matches = (booking: ExpandedBooking, key: TabKey) => {
    switch (key) {
      case 'upcoming':
        return booking.status === 'confirmed' && booking.date >= today;
      case 'pending':
        return booking.status === 'pending';
      case 'done':
        return booking.status === 'done';
      case 'cancelled':
        return ['cancelled', 'declined', 'withdrawn'].includes(booking.status);
      default:
        return true;
    }
  };

  const visible = bookings.filter((booking) => matches(booking, tab));

  const act = async (bookingId: string, action: 'accept' | 'decline' | 'cancel', reason?: string) => {
    setPendingAction(bookingId);
    try {
      const result = await api.post<{ booking: ExpandedBooking; refund?: number }>(
        `/api/bookings/${bookingId}`,
        { action, reason },
      );
      setBookings((current) => current.map((b) => (b.id === bookingId ? result.booking : b)));
      toast(
        action === 'accept'
          ? t('owner', 'accepted')
          : action === 'decline'
            ? t('owner', 'declined')
            : t('bookings', 'cancelled_success'),
        'success',
      );
      router.refresh();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setPendingAction(null);
      setCancelTarget(null);
    }
  };

  return (
    <>
      {/* ------------------------------------------------------- tabs */}
      <div className="-mx-4 mb-4 md:mx-0">
        <div className="rail px-4 md:px-0" role="tablist">
          {TABS.map((item) => {
            const count = bookings.filter((booking) => matches(booking, item.key)).length;
            const selected = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.key)}
                className={cx(
                  'flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors',
                  selected
                    ? 'bg-ink font-bold text-white'
                    : 'border border-line bg-white font-medium text-ink-soft hover:border-ink-faint',
                )}
              >
                {t('bookings', item.labelKey)}
                <span className={cx('text-xs tabular-nums', selected ? 'text-white/70' : 'text-ink-faint')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------- results */}
      {visible.length === 0 ? (
        <EmptyState
          icon="tag"
          title={role === 'owner' ? t('owner', 'bookingsEmpty') : t('bookings', 'emptyTitle')}
          body={role === 'owner' ? undefined : t('bookings', 'emptyBody')}
          action={
            role === 'customer' ? (
              <LinkButton href="/">{t('bookings', 'emptyCta')}</LinkButton>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((booking) => (
            <li key={booking.id}>
              <BookingRow
                booking={booking}
                role={role}
                busy={pendingAction === booking.id}
                onAccept={() => act(booking.id, 'accept')}
                onDecline={() => act(booking.id, 'decline')}
                onCancel={() => setCancelTarget(booking)}
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && act(cancelTarget.id, 'cancel')}
        title={t('bookings', 'cancelBookingTitle')}
        confirmLabel={t('bookings', 'cancelBookingConfirm')}
        cancelLabel={t('bookings', 'keepBooking')}
        loading={Boolean(pendingAction)}
        body={
          cancelTarget ? (
            <p>
              {t('bookings', 'cancelBookingBody', {
                refund: cancelTarget.isFreeCancellation
                  ? formatMoney(cancelTarget.breakdown.dueNow, cancelTarget.currency)
                  : formatMoney(0, cancelTarget.currency),
              })}
              {!cancelTarget.isFreeCancellation && cancelTarget.breakdown.dueNow > 0 ? (
                <span className="mt-2 block text-danger">
                  {t('bookings', 'cancellationFeeApplies', {
                    amount: formatMoney(cancelTarget.breakdown.dueNow, cancelTarget.currency),
                  })}
                </span>
              ) : null}
            </p>
          ) : null
        }
      />
    </>
  );
}

function BookingRow({
  booking,
  role,
  busy,
  onAccept,
  onDecline,
  onCancel,
}: {
  booking: ExpandedBooking;
  role: BookingRole;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  const detailHref =
    role === 'owner' ? `/owner/bookings/${booking.id}` : `/account/bookings/${booking.id}`;
  const inboxHref =
    role === 'owner' ? `/owner/inbox/${booking.threadId}` : `/account/inbox/${booking.threadId}`;

  const counterparty =
    role === 'owner' ? booking.customer?.displayName : booking.owner?.displayName;

  return (
    <article className="rounded-card border border-line bg-white p-3 shadow-card">
      <div className="flex gap-3">
        <PhotoFrame
          photo={booking.charter?.photo ?? null}
          rounded="rounded-lg"
          className="h-20 w-24 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-sm font-bold text-ink">
              <Link href={detailHref} className="hover:underline">
                <span className="line-clamp-1">{booking.charter?.title}</span>
              </Link>
            </h3>
            <Badge tone={STATUS_TONE[booking.status]}>{t('bookings', STATUS_LABEL[booking.status])}</Badge>
          </div>

          <p className="mt-0.5 text-xs text-ink-muted">
            {t('bookings', 'reference', { code: booking.reference })}
            {counterparty ? ` · ${t('bookings', 'withOwner', { owner: counterparty })}` : ''}
          </p>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            <span className="flex items-center gap-1">
              <Icon name="calendar" size={13} />
              {formatDate(booking.date, 'medium')}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="clock" size={13} />
              {formatTime(booking.departureTime)}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="users" size={13} />
              {booking.adults + booking.children}
            </span>
          </p>

          <p className="mt-1 text-sm font-bold text-ink">
            {formatMoney(booking.breakdown.total, booking.currency)}
            {booking.breakdown.dueOnArrival > 0 ? (
              <span className="ml-2 text-xs font-normal text-ink-muted">
                {t('bookings', 'dueOnArrival')}:{' '}
                {formatMoney(booking.breakdown.dueOnArrival, booking.currency)}
              </span>
            ) : null}
          </p>

          {/* Owners see a countdown on requests they have not answered. */}
          {role === 'owner' && booking.status === 'pending' && booking.respondByAt ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-warning">
              <Icon name="clock" size={12} />
              {t('owner', 'expiresIn', { time: hoursUntil(booking.respondByAt) })}
            </p>
          ) : null}

          {booking.status === 'confirmed' && booking.freeCancellationUntil && booking.isFreeCancellation ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-success">
              <Icon name="check-circle" size={12} />
              {t('bookings', 'freeCancellationUntil', {
                date: formatDate(booking.freeCancellationUntil, 'medium'),
              })}
            </p>
          ) : null}
        </div>
      </div>

      {/* ----------------------------------------------------- actions */}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        <LinkButton href={detailHref} variant="outline" size="sm">
          {t('bookings', 'viewDetails')}
        </LinkButton>

        {booking.threadId ? (
          <LinkButton href={inboxHref} variant="ghost" size="sm" icon="message">
            {role === 'owner' ? t('inbox', 'title') : t('bookings', 'messageOwner')}
          </LinkButton>
        ) : null}

        {role === 'owner' && booking.status === 'pending' ? (
          <>
            <Button size="sm" onClick={onAccept} loading={busy}>
              {t('owner', 'acceptBooking')}
            </Button>
            <Button size="sm" variant="outline" onClick={onDecline} disabled={busy}>
              {t('owner', 'declineBooking')}
            </Button>
          </>
        ) : null}

        {booking.canCancel ? (
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy} className="text-danger">
            {t('bookings', 'cancelBooking')}
          </Button>
        ) : null}

        {role === 'customer' && booking.canReview ? (
          <LinkButton href="/account/reviews" size="sm" icon="star-empty">
            {t('bookings', 'leaveReview')}
          </LinkButton>
        ) : null}

        {role === 'customer' && booking.status === 'done' ? (
          <LinkButton href={`/charters/view/${booking.charterId}`} variant="ghost" size="sm">
            {t('bookings', 'rebook')}
          </LinkButton>
        ) : null}
      </div>
    </article>
  );
}

/** Coarse "6h" / "45m" countdown for a pending request. */
function hoursUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return '0h';
  const hours = Math.floor(diff / 3_600_000);
  return hours >= 1 ? `${hours}h` : `${Math.max(1, Math.floor(diff / 60_000))}m`;
}
