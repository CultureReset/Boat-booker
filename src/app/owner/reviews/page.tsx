import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { expandReview } from '@/lib/services/reviews';
import { reviewStatisticsFor } from '@/lib/services/charters';
import { reviewCriteria } from '@/config/taxonomy';
import { EmptyState, SectionHeading, Stars } from '@/components/ui/primitives';
import { OwnerReviewList } from '@/components/owner/OwnerReviewList';

export const metadata: Metadata = { title: t('navigation', 'reviews') };

/** Reviews left on the owner's listings, with the aggregate breakdown. */
export default async function OwnerReviewsPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  const own = db.reviews.filter((review) => review.ownerId === user.id);
  const statistics = reviewStatisticsFor(own);
  const reviews = own
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((review) => expandReview(db, review));

  return (
    <>
      <SectionHeading title={t('navigation', 'reviews')} level={1} />

      {statistics.reviewCount === 0 ? (
        <EmptyState icon="star-empty" title={t('viewCharter', 'noReviewsTitle')} body={t('viewCharter', 'noReviewsBody')} />
      ) : (
        <>
          <section className="mb-5 grid gap-5 rounded-card border border-line bg-white p-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-extrabold tabular-nums text-ink">
                  {statistics.rating.toFixed(1)}
                </span>
                <span>
                  <Stars rating={statistics.rating} size={16} />
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {t('listingCard', 'reviewCount', {
                      count: statistics.reviewCount,
                      p: statistics.reviewCount,
                    })}
                  </span>
                </span>
              </div>
            </div>

            <dl className="space-y-2.5">
              {reviewCriteria.map((criterion) => {
                const value = statistics[criterion.key];
                return (
                  <div key={criterion.key} className="flex items-center justify-between gap-3">
                    <dt className="text-sm text-ink-soft">{criterion.title}</dt>
                    <dd className="flex items-center gap-2">
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                        <span
                          className="block h-full rounded-full bg-ink"
                          style={{ width: `${(value / 5) * 100}%` }}
                        />
                      </span>
                      <span className="w-7 text-right text-sm font-semibold tabular-nums text-ink">
                        {value.toFixed(1)}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>

          <OwnerReviewList reviews={reviews} />
        </>
      )}
    </>
  );
}
