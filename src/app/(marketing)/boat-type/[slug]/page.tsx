import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { boatTypeBySlug, boatTypes } from '@/config/taxonomy';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { buildCharterCard, indexPackages, indexReviews } from '@/lib/services/charters';
import { EmptyState, LinkButton, SectionHeading } from '@/components/ui/primitives';
import { ListingCard } from '@/components/listing/ListingCard';
import { SearchWidget } from '@/components/search/SearchWidget';

export async function generateStaticParams() {
  return boatTypes.map((type) => ({ slug: type.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const type = boatTypeBySlug.get(slug);
  if (!type) return { title: t('errors', 'notFoundTitle') };

  return {
    title: `${type.title} charters`,
    description: `Compare and book ${type.title.toLowerCase()} charters. Real availability and verified operators.`,
    alternates: { canonical: `/boat-type/${type.slug}` },
  };
}

export default async function BoatTypePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const type = boatTypeBySlug.get(slug);
  if (!type) notFound();

  const db = await getDb();
  const packagesByCharter = indexPackages(db);
  const reviewsByCharter = indexReviews(db);

  const matching = db.charters.filter(
    (charter) => charter.published && !charter.snoozed && charter.boat.type === type.title,
  );

  const cards = matching.slice(0, 12).map((charter) => {
    const destination = db.destinations.find((d) => d.id === charter.destinationId)!;
    const country = db.countries.find((c) => c.id === destination.countryId);
    const state = destination.stateId ? db.states.find((s) => s.id === destination.stateId) : undefined;
    return buildCharterCard({
      charter,
      packages: packagesByCharter.get(charter.id) ?? [],
      reviews: reviewsByCharter.get(charter.id) ?? [],
      destination,
      countryTitle: country?.title ?? '',
      stateAbbrev: state?.abbrev,
      currency: 'USD',
      guests: 2,
    });
  });

  const byDestination = new Map<string, number>();
  for (const charter of matching) {
    byDestination.set(charter.destinationId, (byDestination.get(charter.destinationId) ?? 0) + 1);
  }

  const destinations = Array.from(byDestination.entries())
    .map(([destinationId, count]) => {
      const destination = db.destinations.find((d) => d.id === destinationId)!;
      return { slug: destination.slug, title: destination.title, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-shell px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
          <li><Link href="/" className="hover:underline">{t('navigation', 'home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/boat-type" className="hover:underline">{t('boatTypes', 'title')}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-ink-soft" aria-current="page">{type.title}</li>
        </ol>
      </nav>

      <SectionHeading
        title={`${type.title} charters`}
        subtitle={`${type.category}${type.powered ? ' · Powered' : ' · Sail or paddle'}`}
        level={1}
      />

      <div className="mb-6">
        <SearchWidget variant="bar" />
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon="boat"
          title={t('search', 'emptyTitle')}
          action={<LinkButton href="/boat-type">{t('boatTypes', 'title')}</LinkButton>}
        />
      ) : (
        <>
          <h2 className="mb-3 text-base font-bold text-ink">
            {t('destinations', 'charterCount', { count: matching.length })}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((charter, index) => (
              <li key={charter.id}>
                <ListingCard charter={charter} index={index} total={cards.length} />
              </li>
            ))}
          </ul>

          {matching.length > cards.length ? (
            <div className="mt-5 text-center">
              <LinkButton href={`/charters/search?boat_types=${type.slug}`} variant="outline" size="lg">
                {t('search', 'showXResults', { count: matching.length })}
              </LinkButton>
            </div>
          ) : null}
        </>
      )}

      {destinations.length ? (
        <section className="mt-10">
          <h2 className="mb-3 text-base font-bold text-ink">{t('destinations', 'title')}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((destination) => (
              <li key={destination.slug}>
                <Link
                  href={`/charters/search?destination=${destination.slug}&boat_types=${type.slug}`}
                  className="flex items-center justify-between gap-2 rounded-control border border-line bg-white px-3 py-2.5 text-sm transition-colors hover:border-brand-400"
                >
                  <span className="truncate font-medium text-ink">
                    {t('boatTypes', 'inDestination', {
                      boatType: type.title,
                      destination: destination.title,
                    })}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-faint">{destination.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
