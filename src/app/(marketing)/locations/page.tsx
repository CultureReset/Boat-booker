import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { PhotoFrame, SectionHeading } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

export const metadata: Metadata = {
  title: t('destinations', 'locationsTitle'),
  alternates: { canonical: '/locations' },
};

/**
 * Location index.
 *
 * Optionally narrowed by `?country=`, which is where the country index links.
 */
export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const countryCode = typeof query.country === 'string' ? query.country : undefined;

  const db = await getDb();

  const counts = new Map<string, number>();
  for (const charter of db.charters) {
    if (!charter.published) continue;
    counts.set(charter.destinationId, (counts.get(charter.destinationId) ?? 0) + 1);
  }

  const selectedCountry = countryCode
    ? db.countries.find((c) => c.code === countryCode)
    : undefined;

  const destinations = db.destinations
    .filter((d) => (counts.get(d.id) ?? 0) > 0)
    .filter((d) => !selectedCountry || d.countryId === selectedCountry.id)
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
    .sort((a, b) => b.count - a.count);

  const countryChips = db.countries
    .map((country) => ({
      code: country.code,
      title: country.title,
      count: db.destinations
        .filter((d) => d.countryId === country.id)
        .reduce((sum, d) => sum + (counts.get(d.id) ?? 0), 0),
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto max-w-shell px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
          <li><Link href="/" className="hover:underline">{t('navigation', 'home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li className={selectedCountry ? '' : 'font-medium text-ink-soft'}>
            {selectedCountry ? (
              <Link href="/locations" className="hover:underline">{t('destinations', 'locationsTitle')}</Link>
            ) : (
              t('destinations', 'locationsTitle')
            )}
          </li>
          {selectedCountry ? (
            <>
              <li aria-hidden="true">/</li>
              <li className="font-medium text-ink-soft" aria-current="page">{selectedCountry.title}</li>
            </>
          ) : null}
        </ol>
      </nav>

      <SectionHeading
        title={selectedCountry ? selectedCountry.title : t('destinations', 'locationsTitle')}
        subtitle={t('destinations', 'charterCount', {
          count: destinations.reduce((sum, d) => sum + d.count, 0),
        })}
        level={1}
      />

      {/* Country filter chips */}
      <div className="-mx-4 mb-5 px-4">
        <ul className="rail">
          <li className="shrink-0">
            <Link
              href="/locations"
              className={cx(
                'flex h-9 items-center rounded-full px-3.5 text-sm transition-colors',
                !selectedCountry
                  ? 'bg-ink font-bold text-white'
                  : 'border border-line bg-white font-medium text-ink-soft',
              )}
            >
              {t('bookings', 'all')}
            </Link>
          </li>
          {countryChips.map((country) => (
            <li key={country.code} className="shrink-0">
              <Link
                href={`/locations?country=${country.code}`}
                className={cx(
                  'flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors',
                  selectedCountry?.code === country.code
                    ? 'bg-ink font-bold text-white'
                    : 'border border-line bg-white font-medium text-ink-soft',
                )}
              >
                {country.title}
                <span
                  className={cx(
                    'text-xs',
                    selectedCountry?.code === country.code ? 'text-white/70' : 'text-ink-faint',
                  )}
                >
                  {country.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {destinations.map((destination) => (
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
              <span className="mt-1.5 block text-xs text-ink-muted">
                {t('destinations', 'charterCount', { count: destination.count })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
