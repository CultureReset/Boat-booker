import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { DirectError, resolveInvite } from '@/lib/services/direct';
import { Outcome } from '@/components/payments/TipFlow';

export const metadata: Metadata = {
  title: t('direct', 'title', { brand: brand.name }),
  robots: { index: false, follow: false },
};

/**
 * Where a Direct invite lands.
 *
 * Nothing is rendered here in the success case — the invite is a shortcut to
 * the operator's own listing, so the guest is sent straight there rather than
 * being shown an interstitial they would only have to tap through.
 */
export default async function DirectLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: token } = await searchParams;
  if (!token) notFound();

  const db = await getDb();

  try {
    // `resolveInvite` also records the open, which is how an operator knows a
    // decal or a text actually reached someone.
    const invite = resolveInvite(db, token);
    redirect(`/charters/view/${invite.charterId}?via=direct`);
  } catch (error) {
    // `redirect` throws by design; only a real DirectError renders a page.
    if (!(error instanceof DirectError)) throw error;

    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <Outcome
          icon={error.code === 'expired' ? 'clock' : 'alert'}
          tone={error.code === 'expired' ? 'neutral' : 'danger'}
          title={t('pay', error.code === 'expired' ? 'sessionExpiredTitle' : 'accessDeniedTitle')}
          body={t('pay', error.code === 'expired' ? 'sessionExpiredBody' : 'accessDeniedBody')}
          href="/"
        />
      </div>
    );
  }
}
