import Link from 'next/link';
import { translate as t } from '@/i18n/translate';
import { Icon } from '@/components/ui/Icon';

/**
 * Change and cancel controls for the booking detail page.
 *
 * Both are links rather than in-place buttons. Cancelling now shows a penalty
 * assessment and a reason taxonomy before it commits, and changing is a
 * three-step flow — neither fits in a confirmation dialog, and pretending
 * otherwise would hide the consequences behind a single tap.
 */
export function BookingActions({
  bookingId,
  role,
  canCancel,
  canRequestChange,
}: {
  bookingId: string;
  role: 'customer' | 'owner';
  canCancel: boolean;
  canRequestChange: boolean;
}) {
  if (!canCancel && !canRequestChange) return null;

  const base = `${role === 'owner' ? '/owner' : '/account'}/bookings/${bookingId}`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {canRequestChange ? (
        <Link
          href={`${base}/change`}
          className="flex flex-1 items-center justify-center gap-2 rounded-control border border-line bg-white py-2.5 text-sm font-bold text-ink transition-colors hover:bg-surface-sunken"
        >
          <Icon name="edit" size={16} />
          {t('changeBooking', 'pageTitle')}
        </Link>
      ) : null}

      {canCancel ? (
        <Link
          href={`${base}/cancel`}
          className="flex flex-1 items-center justify-center gap-2 rounded-control border border-danger/40 bg-white py-2.5 text-sm font-bold text-danger transition-colors hover:bg-danger/5"
        >
          <Icon name="close" size={16} />
          {t('cancel', 'pageTitle')}
        </Link>
      ) : null}
    </div>
  );
}
