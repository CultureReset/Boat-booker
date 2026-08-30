import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { currentUser } from '@/lib/auth/session';
import { buildBlockIndex } from '@/lib/services/availability';
import { buildCharterDetail } from '@/lib/services/charters';
import { Checkout } from '@/components/booking/Checkout';

export const metadata: Metadata = {
  title: t('booking', 'title'),
  // Checkout URLs carry a specific trip selection and should never be indexed.
  robots: { index: false, follow: false },
};

/**
 * Checkout route.
 *
 * The listing is resolved on the server so the summary card and the trip
 * details are correct on first paint, even before the price quote returns.
 */
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const charterId = typeof query.charter === 'string' ? query.charter : '';
  const adults = Math.max(1, Number(query.adults) || 1);
  const children = Math.max(0, Number(query.children) || 0);

  const db = await getDb();
  const charter = db.charters.find((c) => c.id === charterId);
  if (!charter) notFound();

  const viewer = await currentUser();

  // An offer fixes the trip, date, group and price; checkout renders those as
  // read-only rather than letting the guest edit terms the operator agreed to.
  const offerId = typeof query.offer === 'string' ? query.offer : undefined;
  const offer = offerId
    ? db.offers.find(
        (o) => o.id === offerId && o.customerId === viewer?.id && o.status === 'sent',
      )
    : undefined;

  const detail = buildCharterDetail({
    db,
    charter,
    currency: 'USD',
    guests: adults + children,
    days: 1,
    date: typeof query.date === 'string' ? query.date : undefined,
    blockIndex: buildBlockIndex(db),
    // The meeting address is not revealed until a booking actually exists.
    revealExactAddress: viewer?.id === charter.ownerId,
  });
  if (!detail) notFound();

  return (
    <Suspense fallback={<div className="mx-auto max-w-shell px-4 py-8"><div className="skeleton h-96 w-full rounded-card" /></div>}>
      <Checkout
        charter={detail}
        offer={
          offer
            ? {
                id: offer.id,
                packageId: offer.packageId,
                date: offer.date,
                departureTime: offer.departureTime,
                adults: offer.adults,
                children: offer.children,
                days: offer.days,
                price: offer.price,
                currency: offer.currency,
                expiresAt: offer.expiresAt,
              }
            : undefined
        }
      />
    </Suspense>
  );
}
