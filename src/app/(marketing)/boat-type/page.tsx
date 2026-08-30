import Link from 'next/link';
import type { Metadata } from 'next';
import { boatTypes } from '@/config/taxonomy';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: t('boatTypes', 'title'),
  description: t('boatTypes', 'subtitle'),
  alternates: { canonical: '/boat-type' },
};

/** Boat type index, grouped by category. */
export default async function BoatTypeIndexPage() {
  const db = await getDb();

  const counts = new Map<string, number>();
  for (const charter of db.charters) {
    if (!charter.published) continue;
    counts.set(charter.boat.type, (counts.get(charter.boat.type) ?? 0) + 1);
  }

  const categories = Array.from(new Set(boatTypes.map((type) => type.category)));

  return (
    <div className="mx-auto max-w-shell px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex items-center gap-1 text-xs text-ink-muted">
          <li><Link href="/" className="hover:underline">{t('navigation', 'home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-ink-soft" aria-current="page">{t('boatTypes', 'title')}</li>
        </ol>
      </nav>

      <SectionHeading title={t('boatTypes', 'title')} subtitle={t('boatTypes', 'subtitle')} level={1} />

      <div className="space-y-8">
        {categories.map((category) => {
          const items = boatTypes
            .filter((type) => type.category === category)
            .map((type) => ({ ...type, count: counts.get(type.title) ?? 0 }))
            .filter((type) => type.count > 0);

          if (!items.length) return null;

          return (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <h2 id={`cat-${category}`} className="mb-3 text-base font-bold text-ink">
                {category}
              </h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((type) => (
                  <li key={type.slug}>
                    <Link
                      href={`/boat-type/${type.slug}`}
                      className="flex items-center justify-between gap-2 rounded-control border border-line bg-white px-3 py-3 transition-colors hover:border-brand-400 hover:bg-brand-50/30"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{type.title}</span>
                        <span className="block text-xs text-ink-muted">
                          {t('destinations', 'charterCount', { count: type.count })}
                        </span>
                      </span>
                      <Icon name="chevron-right" size={15} className="shrink-0 text-ink-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
