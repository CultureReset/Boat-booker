import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { cooldownRemaining } from '@/lib/services/verification';
import { Icon } from '@/components/ui/Icon';
import { PhoneVerification } from '@/components/auth/PhoneVerification';

export const metadata: Metadata = {
  title: t('login', 'finishRegistrationTitle'),
  robots: { index: false, follow: false },
};

/**
 * The step between signing up and being able to book.
 *
 * An operator needs a number they can reach the guest on when the weather turns
 * on the morning of a trip, so a booking asks for a verified one. This screen
 * is where that happens — reachable on its own so a guest who skipped it at
 * signup can come back, and skippable so nobody is trapped here.
 *
 * The cooldown is read on the server and handed to the client, so a reload
 * resumes the countdown instead of offering a resend that would be refused.
 */
export default async function FinishRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const next = typeof query.next === 'string' ? query.next : '/account/bookings';

  const user = await currentUser();
  if (!user) redirect(`/login?next=/finish-registration`);

  const db = await getDb();
  const resendAfterSeconds = cooldownRemaining(db, user.id);

  return (
    <div data-app="guest" className="flex min-h-dvh flex-col bg-surface-sunken">
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

      <main id="main" className="flex flex-1 items-start justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-card border border-line bg-white p-6 shadow-card">
          <h1 className="text-xl font-extrabold text-ink">{t('login', 'finishRegistrationTitle')}</h1>
          <p className="mb-5 mt-1 text-sm text-ink-soft">{t('login', 'finishRegistrationBody')}</p>

          <PhoneVerification
            initial={{
              phone: user.phone ?? null,
              verified: Boolean(user.phoneVerifiedAt),
              resendAfterSeconds,
            }}
            next={next}
          />

          {/* Leaving is a link, not a button: skipping is the low-emphasis
              path, and nothing here should compete with the code field. */}
          <p className="mt-5 text-center text-sm">
            <Link href={next} className="font-semibold text-ink-muted hover:text-ink hover:underline">
              {t('login', 'skipForNow')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
