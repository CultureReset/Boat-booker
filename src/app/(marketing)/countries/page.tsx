import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: t('destinations', 'countriesTitle'),
  alternates: { canonical: '/countries' },
};

/** Country index, grouped by continent. */
export default async function CountriesPage() {
  const db = await getDb();

  const countByDestination = new Map<string, number>();
  for (const charter of db.charters) {
    if (!charter.published) continue;
    countByDestination.set(charter.destinationId, (countByDestination.get(charter.destinationId) ?? 0) + 1);
  }

  const rows = db.countries
    .map((country) => {
      const destinations = db.destinations.filter((d) => d.countryId === country.id);
      const charters = destinations.reduce((sum, d) => sum + (countByDestination.get(d.id) ?? 0), 0);
      return { country, destinationCount: destinations.filter((d) => (countByDestination.get(d.id) ?? 0) > 0).length, charters };
    })
    .filter((row) => row.charters > 0);

  const continents = Array.from(new Set(rows.map((row) => row.country.continent))).sort();

  return (
    <div className="mx-auto max-w-shell px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex items-center gap-1 text-xs text-ink-muted">
          <li><Link href="/" className="hover:underline">{t('navigation', 'home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-ink-soft" aria-current="page">{t('destinations', 'countriesTitle')}</li>
        </ol>
      </nav>

      <SectionHeading title={t('destinations', 'countriesTitle')} level={1} />

      <div className="space-y-8">
        {continents.map((continent) => (
          <section key={continent} aria-labelledby={`continent-${continent}`}>
            <h2 id={`continent-${continent}`} className="mb-3 text-base font-bold text-ink">
              {continent}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows
                .filter((row) => row.country.continent === continent)
                .sort((a, b) => b.charters - a.charters)
                .map((row) => (
                  <li key={row.country.id} id={row.country.code}>
                    <Link
                      href={`/locations?country=${row.country.code}`}
                      className="flex items-center justify-between gap-2 rounded-control border border-line bg-white px-3 py-3 transition-colors hover:border-brand-400"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {row.country.title}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          {row.destinationCount}{' '}
                          {row.destinationCount === 1 ? 'destination' : 'destinations'} ·{' '}
                          {t('destinations', 'charterCount', { count: row.charters })}
                        </span>
                      </span>
                      <Icon name="chevron-right" size={15} className="shrink-0 text-ink-faint" />
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
