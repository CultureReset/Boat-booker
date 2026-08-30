import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { Outcome } from '@/components/payments/TipFlow';
import { RetryLink } from '@/components/booking/BookingProcessing';

export const metadata: Metadata = {
  title: t('pay', 'failedTitle'),
  robots: { index: false, follow: false },
};

export default function BookingFailedPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <Outcome
        icon="alert"
        tone="danger"
        title={t('pay', 'failedTitle')}
        body={t('pay', 'failedBody')}
        action={
          <Suspense fallback={null}>
            <RetryLink />
          </Suspense>
        }
      />
      <p className="mt-4 text-center">
        <Link href="/" className="text-sm font-semibold text-brand-700 hover:underline">
          {t('pay', 'backToListing')}
        </Link>
      </p>
    </div>
  );
}
