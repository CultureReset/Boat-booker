import Link from 'next/link';
import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { Icon } from '@/components/ui/Icon';
import { PhotoFrame, SectionHeading } from '@/components/ui/primitives';
import { SearchWidget } from '@/components/search/SearchWidget';
import { NearMeButton } from '@/components/search/NearMeButton';

export const metadata: Metadata = {
  title: t('navigation', 'boatingNearMe'),
  description: `Find boat tours and charters near you. Real availability from verified operators on ${brand.name}.`,
  alternates: { canonical: '/boating-near-me' },
};

/**
 * "Near me" landing page.
 *
 * Geolocation is client-side and requires permission, so the page has to be
 * useful before it is granted — hence the popular destinations underneath.
 */
export default async function NearMePage() {
  const db = await getDb();

  const counts = new Map<string, number>();
  for (const charter of db.charters) {
    if (!charter.published) continue;
    counts.set(charter.destinationId, (counts.get(charter.destinationId) ?? 0) + 1);
  }

  const popular = db.destinations
    .filter((d) => (counts.get(d.id) ?? 0) > 0)
    .map((d) => {
      const country = db.countries.find((c) => c.id === d.countryId);
      const state = d.stateId ? db.states.find((s) => s.id === d.stateId) : undefined;
      return {
        slug: d.slug,
        title: d.title,
        heroPhoto: d.heroPhoto,
        label: [state?.abbrev, country?.title].filter(Boolean).join(', '),
        count: counts.get(d.id) ?? 0,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-shell px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex items-center gap-1 text-xs text-ink-muted">
          <li><Link href="/" className="hover:underline">{t('navigation', 'home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-ink-soft" aria-current="page">{t('navigation', 'boatingNearMe')}</li>
        </ol>
      </nav>

      <SectionHeading
        title={t('search', 'fishingNearMe')}
        subtitle={t('search', 'emptyResultsNearMe1')}
        level={1}
      />

      <div className="mb-6 rounded-card border border-line bg-white p-4">
        <NearMeButton />
        <p className="mt-2 text-xs text-ink-muted">
          {t('maps', 'approximateLocationBody')}
        </p>
      </div>

      <div className="mb-8">
        <SearchWidget variant="bar" />
      </div>

      <section>
        <h2 className="mb-3 text-base font-bold text-ink">{t('pickers', 'popularDestinations')}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {popular.map((destination) => (
            <li key={destination.slug}>
              <Link href={`/destination/${destination.slug}`} className="group block">
                <PhotoFrame
                  photo={destination.heroPhoto}
                  className="aspect-[4/3] w-full transition-transform group-hover:scale-[1.02]"
                >
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-2.5">
                    <span className="block text-sm font-bold text-white">{destination.title}</span>
                    <span className="block text-[11px] text-white/80">{destination.label}</span>
                  </span>
                </PhotoFrame>
                <span className="mt-1.5 flex items-center gap-1 text-xs text-ink-muted">
                  <Icon name="boat" size={12} />
                  {t('destinations', 'charterCount', { count: destination.count })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
