'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { api } from '@/lib/client/api';
import { Spinner } from '@/components/ui/primitives';

/**
 * Polls a settling booking until it resolves.
 *
 * Backs off as it goes — a payment that has not settled in ten seconds is not
 * going to settle in the next hundred milliseconds — and warns before unload,
 * because leaving mid-settlement is how guests end up thinking a successful
 * payment failed.
 */
export function BookingProcessing() {
  const router = useRouter();
  const params = useSearchParams();
  const bookingId = params.get('booking') ?? '';

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    let attempt = 0;

    const poll = async () => {
      if (cancelled) return;
      attempt += 1;
      setElapsed(attempt);

      try {
        const booking = await api.get<{ status: string }>(`/api/bookings/${bookingId}`);
        if (cancelled) return;

        if (booking.status === 'confirmed' || booking.status === 'pending') {
          router.replace(`/book/confirmation/${bookingId}`);
          return;
        }
        if (booking.status === 'declined' || booking.status === 'cancelled') {
          router.replace(`/booking/failed?booking=${bookingId}`);
          return;
        }
      } catch {
        // A transient error is not a failed payment; keep waiting.
      }

      // 1s, 2s, 3s… capped at 5s, giving up after roughly a minute.
      if (attempt > 20) {
        router.replace(`/booking/failed?booking=${bookingId}`);
        return;
      }
      window.setTimeout(poll, Math.min(attempt, 5) * 1000);
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [bookingId, router]);

  return (
    <div className="rounded-card border border-line bg-white p-8 text-center">
      <Spinner size={32} className="mx-auto text-brand-600" />
      <h1 className="mt-4 text-lg font-bold text-ink">{t('pay', 'processingTitle')}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t('pay', 'processingBody')}</p>
      {elapsed > 5 ? (
        <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs font-semibold text-ink-soft">
          {t('pay', 'processingWarning')}
        </p>
      ) : null}
    </div>
  );
}

/** Sends the guest back to the listing they were trying to book. */
export function RetryLink() {
  const params = useSearchParams();
  const charterId = params.get('charter');
  if (!charterId) return null;

  return (
    <Link
      href={`/charters/view/${charterId}`}
      className="mt-4 inline-block rounded-control bg-brand-600 px-5 py-2.5 text-sm font-bold text-white"
    >
      {t('pay', 'tryAgain')}
    </Link>
  );
}
