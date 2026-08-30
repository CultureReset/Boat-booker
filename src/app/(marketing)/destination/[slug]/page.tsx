import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { activityByKey, boatTypeByTitle } from '@/config/taxonomy';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { buildCharterCard, indexPackages, indexReviews } from '@/lib/services/charters';
import { haversineKm } from '@/lib/services/search';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, LinkButton, PhotoFrame, SectionHeading } from '@/components/ui/primitives';
import { ListingCard } from '@/components/listing/ListingCard';
import { SearchWidget } from '@/components/search/SearchWidget';

/**
 * Destination landing page.
 *
 * The canonical, indexable page for a place — the search results page points
 * its canonical here. Carries the editorial intro, live inventory, and the
 * activity / boat-type / nearby links that make the destination tree
 * crawlable.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = await getDb();

  const destination = db.destinations.find((d) => d.slug === slug);
  if (!destination) return { title: t('errors', 'notFoundTitle') };

  const count = db.charters.filter((c) => c.destinationId === destination.id && c.published).length;

  return {
    title: t('destinations', 'inDestination', { destination: destination.title }),
    description: destination.blurb,
    alternates: { canonical: `/destination/${destination.slug}` },
    openGraph: {
      title: t('search', 'metaTitle', { destination: destination.title, count }),
      description: destination.blurb,
    },
  };
}

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();

  const destination = db.destinations.find((d) => d.slug === slug);
  if (!destination) notFound();

  const country = db.countries.find((c) => c.id === destination.countryId);
  const state = destination.stateId ? db.states.find((s) => s.id === destination.stateId) : undefined;

  const packagesByCharter = indexPackages(db);
  const reviewsByCharter = indexReviews(db);

  const matching = db.charters.filter(
    (charter) => charter.published && !charter.snoozed && charter.destinationId === destination.id,
  );

  // Lead with the best-reviewed boats — a destination page is a shop window.
  const ranked = [...matching].sort((a, b) => {
    const ra = reviewsByCharter.get(a.id) ?? [];
    const rb = reviewsByCharter.get(b.id) ?? [];
    const avg = (list: typeof ra) =>
      list.length ? list.reduce((sum, r) => sum + r.rating, 0) / list.length : 0;
    return avg(rb) - avg(ra) || rb.length - ra.length;
  });

  const cards = ranked.slice(0, 12).map((charter) =>
    buildCharterCard({
      charter,
      packages: packagesByCharter.get(charter.id) ?? [],
      reviews: reviewsByCharter.get(charter.id) ?? [],
      destination,
      countryTitle: country?.title ?? '',
      stateAbbrev: state?.abbrev,
      currency: 'USD',
      guests: 2,
    }),
  );

  // Activities and boat types actually available here.
  const activityCounts = new Map<string, number>();
  const boatTypeCounts = new Map<string, number>();
  for (const charter of matching) {
    for (const key of charter.activityKeys) {
      activityCounts.set(key, (activityCounts.get(key) ?? 0) + 1);
    }
    boatTypeCounts.set(charter.boat.type, (boatTypeCounts.get(charter.boat.type) ?? 0) + 1);
  }

  const topActivities = Array.from(activityCounts.entries())
    .map(([key, count]) => ({ activity: activityByKey.get(key), count }))
    .filter((entry) => entry.activity)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topBoatTypes = Array.from(boatTypeCounts.entries())
    .map(([title, count]) => ({ type: boatTypeByTitle.get(title), count }))
    .filter((entry) => entry.type)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const nearby = db.destinations
    .filter((d) => d.id !== destination.id)
    .map((d) => ({
      slug: d.slug,
      title: d.title,
      distanceKm: haversineKm(destination.geoPoint, d.geoPoint),
      count: db.charters.filter((c) => c.destinationId === d.id && c.published).length,
    }))
    .filter((d) => d.count > 0)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8);

  return (
    <div>
      {/* --------------------------------------------------------- hero */}
      <div className="relative">
        <PhotoFrame photo={destination.heroPhoto} rounded="rounded-none" className="h-48 w-full md:h-64">
          <span className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent" />
        </PhotoFrame>

        <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
          <div className="mx-auto max-w-shell">
            <nav aria-label="Breadcrumb" className="mb-1.5">
              <ol className="flex flex-wrap items-center gap-1 text-xs text-white/80">
                <li><Link href="/" className="hover:underline">{t('navigation', 'home')}</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/locations" className="hover:underline">{t('destinations', 'locationsTitle')}</Link></li>
                <li aria-hidden="true">/</li>
                <li className="font-medium text-white" aria-current="page">{destination.title}</li>
              </ol>
            </nav>
            <h1 className="text-2xl font-extrabold text-white md:text-3xl">
              {t('destinations', 'inDestination', { destination: destination.title })}
            </h1>
            <p className="mt-0.5 text-sm text-white/85">
              {[state?.title, country?.title].filter(Boolean).join(', ')} ·{' '}
              {t('destinations', 'charterCount', { count: matching.length })}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-shell px-4 py-6">
        <div className="mb-6">
          <SearchWidget
            variant="bar"
            initial={{
              destinationSlug: destination.slug,
              destinationLabel: [destination.title, state?.abbrev, country?.title]
                .filter(Boolean)
                .join(', '),
            }}
          />
        </div>

        {destination.blurb ? (
          <section className="mb-8 rounded-card border border-line bg-surface-sunken p-4">
            <h2 className="mb-1.5 text-base font-bold text-ink">
              {t('destinations', 'aboutDestination', { destination: destination.title })}
            </h2>
            <p className="text-sm leading-relaxed text-ink-soft">{destination.blurb}</p>
          </section>
        ) : null}

        {cards.length === 0 ? (
          <EmptyState
            icon="search"
            title={t('search', 'emptyTitle')}
            action={<LinkButton href="/locations">{t('destinations', 'locationsTitle')}</LinkButton>}
          />
        ) : (
          <section>
            <SectionHeading
              title={t('destinations', 'topRatedIn', { destination: destination.title })}
              action={
                <Link
                  href={`/charters/search?destination=${destination.slug}`}
                  className="text-sm font-semibold text-brand-700 hover:underline"
                >
                  {t('general', 'seeAll')}
                </Link>
              }
            />
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((charter, index) => (
                <li key={charter.id}>
                  <ListingCard charter={charter} index={index} total={cards.length} />
                </li>
              ))}
            </ul>

            {matching.length > cards.length ? (
              <div className="mt-5 text-center">
                <LinkButton href={`/charters/search?destination=${destination.slug}`} variant="outline" size="lg">
                  {t('search', 'showXResults', { count: matching.length })}
                </LinkButton>
              </div>
            ) : null}
          </section>
        )}

        {topActivities.length ? (
          <section className="mt-10">
            <h2 className="mb-3 text-base font-bold text-ink">
              {t('destinations', 'popularActivitiesIn', { destination: destination.title })}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {topActivities.map(({ activity, count }) => (
                <li key={activity!.slug}>
                  <Link
                    href={`/charters/search?destination=${destination.slug}&activities=${activity!.slug}`}
                    className="flex h-9 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm font-medium text-ink transition-colors hover:border-brand-400"
                  >
                    {activity!.title}
                    <span className="text-xs text-ink-faint">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {topBoatTypes.length ? (
          <section className="mt-8">
            <h2 className="mb-3 text-base font-bold text-ink">
              {t('destinations', 'popularBoatTypesIn', { destination: destination.title })}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {topBoatTypes.map(({ type, count }) => (
                <li key={type!.slug}>
                  <Link
                    href={`/charters/search?destination=${destination.slug}&boat_types=${type!.slug}`}
                    className="flex h-9 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm font-medium text-ink transition-colors hover:border-brand-400"
                  >
                    {type!.title}
                    <span className="text-xs text-ink-faint">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {nearby.length ? (
          <section className="mt-8">
            <h2 className="mb-3 text-base font-bold text-ink">{t('destinations', 'nearbyDestinations')}</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {nearby.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/destination/${item.slug}`}
                    className="flex items-center justify-between gap-2 rounded-control border border-line bg-white px-3 py-2.5 transition-colors hover:border-brand-400"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{item.title}</span>
                      <span className="block text-xs text-ink-muted">
                        {Math.round(item.distanceKm)} km · {item.count}
                      </span>
                    </span>
                    <Icon name="chevron-right" size={15} className="shrink-0 text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
