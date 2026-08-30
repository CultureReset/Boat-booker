'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/providers/ToastProvider';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/primitives';

/**
 * Cancel control for the booking detail page.
 *
 * The confirmation spells out the exact refund before anything is committed —
 * a cancellation is irreversible and can forfeit a deposit, so the number goes
 * in front of the user, not in a policy link.
 */
export function BookingActions({
  bookingId,
  canCancel,
  isFree,
  refundAmount,
  forfeitAmount,
}: {
  bookingId: string;
  canCancel: boolean;
  isFree: boolean;
  refundAmount: string;
  forfeitAmount: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!canCancel) return null;

  const cancel = async () => {
    setBusy(true);
    try {
      await api.post(`/api/bookings/${bookingId}`, { action: 'cancel' });
      toast(t('bookings', 'cancelled_success'), 'success');
      setOpen(false);
      router.refresh();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" className="text-danger" onClick={() => setOpen(true)}>
        {t('bookings', 'cancelBooking')}
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={cancel}
        loading={busy}
        title={t('bookings', 'cancelBookingTitle')}
        confirmLabel={t('bookings', 'cancelBookingConfirm')}
        cancelLabel={t('bookings', 'keepBooking')}
        body={
          <p>
            {t('bookings', 'cancelBookingBody', { refund: isFree ? refundAmount : '—' })}
            {!isFree ? (
              <span className="mt-2 block text-danger">
                {t('bookings', 'cancellationFeeApplies', { amount: forfeitAmount })}
              </span>
            ) : null}
          </p>
        }
      />
    </>
  );
}
