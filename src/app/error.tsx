'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { translate as t } from '@/i18n/translate';
import { Icon } from '@/components/ui/Icon';

/**
 * Root error boundary.
 *
 * Shows a recoverable state rather than a blank page. The digest is displayed
 * so a user can quote it to support — the message itself is not, because it
 * can carry internal detail.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this is where an error reporter would be called.
    if (process.env.NODE_ENV === 'development') console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-danger">
        <Icon name="alert" size={30} />
      </span>
      <h1 className="mt-4 text-xl font-extrabold text-ink md:text-2xl">
        {t('errors', 'serverErrorTitle')}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">{t('errors', 'serverErrorBody')}</p>

      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-ink-faint">{error.digest}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex h-11 items-center gap-2 rounded-control bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Icon name="refresh" size={16} />
          {t('errors', 'tryAgain')}
        </button>
        <Link
          href="/"
          className="flex h-11 items-center rounded-control border border-line px-5 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken"
        >
          {t('errors', 'notFoundCta')}
        </Link>
      </div>
    </div>
  );
}
