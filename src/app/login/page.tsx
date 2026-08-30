import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { Icon } from '@/components/ui/Icon';
import { LoginPanel } from '@/components/auth/LoginPanel';

export const metadata: Metadata = {
  title: t('login', 'welcomeTitle'),
  robots: { index: false, follow: true },
};

/**
 * Standalone login page.
 *
 * Most sign-ins happen in the modal; this page exists for direct links, for
 * redirects out of protected routes, and as the target the mobile tab bar uses
 * when a signed-out user taps the account tab.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const next = typeof query.next === 'string' ? query.next : '/';
  const intent = query.intent === 'owner' ? 'owner' : 'customer';

  // Already signed in — go straight where they were headed.
  const user = await currentUser();
  if (user) redirect(next);

  return (
    <div className="flex min-h-dvh flex-col bg-surface-sunken">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-shell items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Icon name="anchor" size={18} strokeWidth={2.2} />
            </span>
            <span className="text-base font-extrabold tracking-tight text-ink">{brand.name}</span>
          </Link>
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-card border border-line bg-white p-6 shadow-card">
          <Suspense fallback={<div className="skeleton h-80 w-full rounded" />}>
            <LoginPanel next={next} intent={intent} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
