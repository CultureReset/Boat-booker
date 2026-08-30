import { Suspense } from 'react';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: t('login', 'forgotPasswordTitle'),
  robots: { index: false, follow: false },
};

/** Landing page for a password-reset link. */
export default function ResetPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-sunken px-4 py-8">
      <div className="w-full max-w-sm rounded-card border border-line bg-white p-6 shadow-card">
        <Suspense fallback={<div className="skeleton h-64 w-full rounded" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
