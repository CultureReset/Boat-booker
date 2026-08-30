import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { buildCharterCard, indexPackages, indexReviews } from '@/lib/services/charters';
import { EmptyState, LinkButton, SectionHeading } from '@/components/ui/primitives';
import { ListingCard } from '@/components/listing/ListingCard';

export const metadata: Metadata = { title: t('wishlist', 'title') };

export default async function WishlistPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  const packagesByCharter = indexPackages(db);
  const reviewsByCharter = indexReviews(db);

  const cards = db.wishlist
    .filter((item) => item.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((item) => {
      const charter = db.charters.find((c) => c.id === item.charterId);
      if (!charter) return [];

      const destination = db.destinations.find((d) => d.id === charter.destinationId);
      if (!destination) return [];

      const country = db.countries.find((c) => c.id === destination.countryId);
      const state = destination.stateId ? db.states.find((s) => s.id === destination.stateId) : undefined;

      return [
        buildCharterCard({
          charter,
          packages: packagesByCharter.get(charter.id) ?? [],
          reviews: reviewsByCharter.get(charter.id) ?? [],
          destination,
          countryTitle: country?.title ?? '',
          stateAbbrev: state?.abbrev,
          currency: user.currency,
          guests: 1,
        }),
      ];
    });

  return (
    <>
      <SectionHeading
        title={t('wishlist', 'title')}
        subtitle={cards.length ? t('wishlist', 'savedCount', { count: cards.length }) : undefined}
        level={1}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon="heart"
          title={t('wishlist', 'emptyTitle')}
          body={t('wishlist', 'emptyBody')}
          action={<LinkButton href="/">{t('wishlist', 'emptyCta')}</LinkButton>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((charter, index) => (
            <li key={charter.id}>
              <ListingCard charter={charter} saved index={index} total={cards.length} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
