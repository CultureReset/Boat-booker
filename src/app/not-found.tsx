import Link from 'next/link';
import { translate as t } from '@/i18n/translate';
import { Icon } from '@/components/ui/Icon';

/** 404. Offers a way back into the destination tree rather than a dead end. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
        <Icon name="search" size={30} />
      </span>
      <h1 className="mt-4 text-xl font-extrabold text-ink md:text-2xl">
        {t('errors', 'notFoundTitle')}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">{t('errors', 'notFoundBody')}</p>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href="/"
          className="flex h-11 items-center rounded-control bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          {t('errors', 'notFoundCta')}
        </Link>
        <Link
          href="/locations"
          className="flex h-11 items-center rounded-control border border-line px-5 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken"
        >
          {t('destinations', 'locationsTitle')}
        </Link>
      </div>
    </div>
  );
}
