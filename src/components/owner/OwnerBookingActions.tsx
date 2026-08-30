'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/providers/ToastProvider';
import type { BookingStatus } from '@/lib/domain/types';
import { ConfirmDialog, Overlay } from '@/components/ui/Overlay';
import { Button, Field, Textarea } from '@/components/ui/primitives';

/**
 * Accept / decline / cancel controls for one booking.
 *
 * Declining asks for a reason: it is passed to the guest, and an unexplained
 * decline is the single most common source of a support ticket.
 */
export function OwnerBookingActions({
  bookingId,
  status,
  threadId,
}: {
  bookingId: string;
  status: BookingStatus;
  threadId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [busy, setBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const act = async (action: 'accept' | 'decline' | 'cancel', withReason?: string) => {
    setBusy(true);
    try {
      await api.post(`/api/bookings/${bookingId}`, { action, reason: withReason });
      toast(
        action === 'accept'
          ? t('owner', 'accepted')
          : action === 'decline'
            ? t('owner', 'declined')
            : t('bookings', 'cancelled_success'),
        'success',
      );
      setDeclineOpen(false);
      setCancelOpen(false);
      router.refresh();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  };

  const canRespond = status === 'pending';
  const canCancel = status === 'confirmed';

  if (!canRespond && !canCancel) return null;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        {canRespond ? (
          <>
            <Button onClick={() => act('accept')} loading={busy} icon="check">
              {t('owner', 'acceptBooking')}
            </Button>
            <Button variant="outline" onClick={() => setDeclineOpen(true)} disabled={busy}>
              {t('owner', 'declineBooking')}
            </Button>
          </>
        ) : null}

        {canCancel ? (
          <Button variant="ghost" className="text-danger" onClick={() => setCancelOpen(true)} disabled={busy}>
            {t('bookings', 'cancelBooking')}
          </Button>
        ) : null}
      </div>

      <Overlay
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title={t('owner', 'declineBooking')}
        size="sm"
        footer={
          <Button fullWidth variant="danger" onClick={() => act('decline', reason)} loading={busy}>
            {t('owner', 'declineBooking')}
          </Button>
        }
      >
        <Field label={t('owner', 'declineReason')} hint={t('general', 'optional')}>
          {({ id }) => (
            <Textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder={t('owner', 'declineReason')}
            />
          )}
        </Field>
      </Overlay>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => act('cancel')}
        loading={busy}
        title={t('bookings', 'cancelBookingTitle')}
        confirmLabel={t('bookings', 'cancelBookingConfirm')}
        cancelLabel={t('bookings', 'keepBooking')}
        body={
          <p>
            {t('bookings', 'cancelBookingBody', { refund: t('general', 'yes') })}
            {threadId ? (
              <span className="mt-2 block text-ink-muted">{t('bookings', 'messageOwner')}</span>
            ) : null}
          </p>
        }
      />
    </>
  );
}
