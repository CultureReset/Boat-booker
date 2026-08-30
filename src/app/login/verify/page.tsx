import { Suspense } from 'react';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { MagicLinkVerifier } from '@/components/auth/MagicLinkVerifier';

export const metadata: Metadata = {
  title: t('login', 'checkYourInbox'),
  robots: { index: false, follow: false },
};

/** Landing page for a password-free login link. */
export default function VerifyPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-sunken px-4">
      <Suspense fallback={<div className="skeleton h-40 w-full max-w-sm rounded-card" />}>
        <MagicLinkVerifier />
      </Suspense>
    </div>
  );
}
