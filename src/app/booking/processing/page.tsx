import { Suspense } from 'react';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { BookingProcessing } from '@/components/booking/BookingProcessing';

export const metadata: Metadata = {
  title: t('pay', 'processingTitle'),
  robots: { index: false, follow: false },
};

/**
 * Async settlement.
 *
 * A payment provider that confirms out of band needs somewhere for the guest
 * to wait that is not the checkout form — otherwise a refresh resubmits, and a
 * back button abandons a payment that is already in flight.
 */
export default function BookingProcessingPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <Suspense fallback={null}>
        <BookingProcessing />
      </Suspense>
    </div>
  );
}
