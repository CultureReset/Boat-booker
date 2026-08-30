import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { expandReview } from '@/lib/services/reviews';
import { SectionHeading } from '@/components/ui/primitives';
import { ReviewsPanel, type AwaitingReview } from '@/components/account/ReviewsPanel';

export const metadata: Metadata = { title: t('reviews', 'title') };

export default async function ReviewsPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  const reviews = db.reviews
    .filter((review) => review.customerId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((review) => expandReview(db, review));

  // Completed trips with no review yet — the prompt at the top of the page.
  const awaiting: AwaitingReview[] = db.bookings
    .filter((b) => b.customerId === user.id && b.status === 'completed' && !b.reviewId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((booking) => {
      const charter = db.charters.find((c) => c.id === booking.charterId);
      return {
        bookingId: booking.id,
        reference: booking.reference,
        date: booking.date,
        charterId: booking.charterId,
        charterTitle: charter?.title ?? '',
        photo: charter?.photos[0]
          ? { placeholder: charter.photos[0].placeholder, altText: charter.photos[0].altText }
          : null,
      };
    });

  return (
    <>
      <SectionHeading title={t('reviews', 'title')} level={1} />
      <ReviewsPanel reviews={reviews} awaiting={awaiting} />
    </>
  );
}
