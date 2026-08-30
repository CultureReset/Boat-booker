import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: t('errors', 'offlineTitle'),
  robots: { index: false, follow: false },
};

/**
 * Offline fallback.
 *
 * The service worker serves this when a navigation fails and nothing is
 * cached. Kept dependency-free so it renders from the cache with no data.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
        <Icon name="globe" size={30} />
      </span>
      <h1 className="mt-4 text-xl font-extrabold text-ink">{t('errors', 'offlineTitle')}</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">{t('errors', 'offlineBody')}</p>
      <Link
        href="/"
        className="mt-5 flex h-11 items-center rounded-control bg-brand-600 px-5 text-sm font-semibold text-white"
      >
        {t('errors', 'notFoundCta')}
      </Link>
    </div>
  );
}
