import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { reviewableBookingFor, reviewQrTarget } from '@/lib/services/direct';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: t('reviewQr', 'pageTitle'),
  robots: { index: false, follow: false },
};

/**
 * Where an operator's review QR code lands.
 *
 * The code is scoped to the listing, not a booking — the operator holds it up
 * at the dock without knowing which of the day's guests will scan it — so the
 * scanner's own completed trip is matched here, after they sign in.
 */
export default async function ScanQrReviewPage({
  params,
}: {
  params: Promise<{ charterId: string }>;
}) {
  const { charterId } = await params;
  const db = await getDb();

  let target: { charterId: string; title: string };
  try {
    target = reviewQrTarget(db, charterId);
  } catch {
    notFound();
  }

  const viewer = await currentUser();

  // A signed-in customer with a reviewable trip goes straight through: the
  // whole point of a QR code is to remove steps.
  if (viewer?.role === 'customer') {
    const bookingId = reviewableBookingFor(db, target.charterId, viewer.id);
    if (bookingId) redirect(`/account/reviews?booking=${bookingId}`);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Icon name="star" size={30} />
      </span>

      <h1 className="mt-4 text-xl font-bold text-ink">{t('reviewQr', 'mainTitle')}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t('reviewQr', 'helpsCaptains', { brand: brand.name })}
      </p>

      <p className="mt-4 text-sm text-ink-soft">
        {viewer
          ? t('reviewQr', 'continueDescription', { charter: target.title })
          : t('reviewQr', 'signInDescription', { charter: target.title })}
      </p>

      {viewer?.role === 'owner' ? (
        <p className="mt-4 rounded-lg bg-warning/10 p-3 text-sm text-ink-soft">
          {t('reviewQr', 'captainNotAllowed')}
        </p>
      ) : viewer ? (
        <p className="mt-4 rounded-lg bg-surface-sunken p-3 text-sm text-ink-soft">
          {t('reviewQr', 'noBooking')}
        </p>
      ) : (
        <Link
          href={`/login?next=/reviews/scan-qr-code/${target.charterId}`}
          className="mt-5 inline-block rounded-control bg-accent px-6 py-3 text-sm font-bold text-white"
        >
          {t('reviewQr', 'signIn')}
        </Link>
      )}

      <p className="mt-6">
        <Link
          href={`/charters/view/${target.charterId}`}
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          {target.title}
        </Link>
      </p>
    </div>
  );
}
