import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: t('destinations', 'statesTitle'),
  alternates: { canonical: '/states' },
};

/** State / region index for the countries that use them. */
export default async function StatesPage() {
  const db = await getDb();

  const countByDestination = new Map<string, number>();
  for (const charter of db.charters) {
    if (!charter.published) continue;
    countByDestination.set(charter.destinationId, (countByDestination.get(charter.destinationId) ?? 0) + 1);
  }

  const rows = db.states
    .map((state) => {
      const destinations = db.destinations.filter((d) => d.stateId === state.id);
      const charters = destinations.reduce((sum, d) => sum + (countByDestination.get(d.id) ?? 0), 0);
      const country = db.countries.find((c) => c.id === state.countryId);
      return {
        state,
        country,
        destinations: destinations
          .filter((d) => (countByDestination.get(d.id) ?? 0) > 0)
          .map((d) => ({ slug: d.slug, title: d.title, count: countByDestination.get(d.id) ?? 0 }))
          .sort((a, b) => b.count - a.count),
        charters,
      };
    })
    .filter((row) => row.charters > 0)
    .sort((a, b) => a.state.title.localeCompare(b.state.title));

  return (
    <div className="mx-auto max-w-shell px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex items-center gap-1 text-xs text-ink-muted">
          <li><Link href="/" className="hover:underline">{t('navigation', 'home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-ink-soft" aria-current="page">{t('destinations', 'statesTitle')}</li>
        </ol>
      </nav>

      <SectionHeading title={t('destinations', 'statesTitle')} level={1} />

      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.state.id} className="rounded-card border border-line bg-white p-4">
            <h2 className="mb-2 text-sm font-bold text-ink">
              {row.state.title}
              <span className="ml-2 text-xs font-normal text-ink-muted">
                {row.country?.title} · {t('destinations', 'charterCount', { count: row.charters })}
              </span>
            </h2>
            <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
              {row.destinations.map((destination) => (
                <li key={destination.slug}>
                  <Link
                    href={`/destination/${destination.slug}`}
                    className="flex items-baseline justify-between gap-2 py-1 text-sm text-ink-soft transition-colors hover:text-brand-700 hover:underline"
                  >
                    <span className="truncate">{destination.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-faint">{destination.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
