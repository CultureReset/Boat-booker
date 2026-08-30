import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { tipContext } from '@/lib/services/payments';
import { TipFlow } from '@/components/payments/TipFlow';

export const metadata: Metadata = {
  title: t('pay', 'tipTitle'),
  robots: { index: false, follow: false },
};

/**
 * Tip a captain after a completed trip.
 *
 * Reached from the booking list and from the post-trip push, so the booking id
 * arrives in the query string rather than the path.
 */
export default async function TipPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking: bookingId } = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/pay/tip?booking=${bookingId ?? ''}`);
  if (!bookingId) notFound();

  const db = await getDb();

  try {
    const context = tipContext(db, bookingId, user.id);
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <TipFlow
          data={{
            bookingId: context.booking.id,
            reference: context.booking.reference,
            date: context.booking.date,
            tripPrice: context.tripPrice,
            currency: context.currency,
            enabled: context.enabled,
            presets: context.presets,
            minAmount: context.minAmount,
            maxAmount: context.maxAmount,
            captainName: context.captainName,
            alreadyTipped: Boolean(context.booking.tip),
          }}
        />
      </div>
    );
  } catch {
    notFound();
  }
}
