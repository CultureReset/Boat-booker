import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { resolveSharedWishlist } from '@/lib/services/memories';
import { buildCharterCard } from '@/lib/services/charters';
import { EmptyState, SectionHeading } from '@/components/ui/primitives';
import { ListingCard } from '@/components/listing/ListingCard';

export const metadata: Metadata = {
  title: t('sharedWishlist', 'title'),
  robots: { index: false, follow: false },
};

/**
 * Someone else's wishlist, opened from a shared link.
 *
 * Shows the boats and the sharer's first name only — a wishlist link gets
 * forwarded onward, and a stranger has no need for the full identity of
 * whoever saved them.
 */
export default async function SharedWishlistPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const db = await getDb();

  if (!token) return <Unavailable />;

  let share: ReturnType<typeof resolveSharedWishlist>;
  try {
    share = resolveSharedWishlist(db, token);
  } catch {
    return <Unavailable />;
  }

  const cards = share.charterIds
    .map((charterId) => {
      const charter = db.charters.find((c) => c.id === charterId && c.published);
      if (!charter) return null;

      const destination = db.destinations.find((d) => d.id === charter.destinationId);
      const country = destination && db.countries.find((c) => c.id === destination.countryId);
      if (!destination) return null;

      return buildCharterCard({
        charter,
        packages: db.packages.filter((p) => p.charterId === charter.id && p.active),
        reviews: db.reviews.filter((r) => r.charterId === charter.id),
        destination,
        countryTitle: country?.title ?? '',
        currency: 'USD',
        guests: 2,
      });
    })
    .filter((card): card is NonNullable<typeof card> => card !== null);

  return (
    <div className="mx-auto w-full max-w-shell px-4 py-6">
      <SectionHeading
        title={t('sharedWishlist', 'ownerTitle', { name: share.ownerFirstName })}
        subtitle={t('sharedWishlist', 'savedCount', { count: cards.length })}
        level={1}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon="heart"
          title={t('sharedWishlist', 'emptyTitle')}
          body={t('sharedWishlist', 'emptyBody')}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.id}>
              <ListingCard charter={card} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Unavailable() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <EmptyState
        icon="alert"
        title={t('sharedWishlist', 'errorTitle')}
        body={t('sharedWishlist', 'errorBody')}
      />
    </div>
  );
}
