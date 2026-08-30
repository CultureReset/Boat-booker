import { Suspense } from 'react';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { SearchResults } from '@/components/search/SearchResults';
import { ListingCardSkeleton } from '@/components/listing/ListingCard';

/**
 * Search results route.
 *
 * The results themselves are client-rendered so filtering and sorting never
 * cost a full page load, but the metadata is generated on the server from the
 * destination in the query string so shared links carry a meaningful title and
 * description.
 */

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const slug = typeof params.destination === 'string' ? params.destination : undefined;

  if (!slug) {
    return {
      title: t('search', 'filters'),
      description: t('homepage', 'metaDescription'),
      // A bare search page with no destination is not a useful index target.
      robots: { index: false, follow: true },
    };
  }

  const db = await getDb();
  const destination = db.destinations.find((d) => d.slug === slug);
  if (!destination) return { title: t('errors', 'notFoundTitle') };

  const count = db.charters.filter((c) => c.destinationId === destination.id && c.published).length;

  return {
    title: t('search', 'metaTitle', { destination: destination.title, count }),
    description: t('search', 'metaDescription', { destination: destination.title }),
    alternates: { canonical: `/destination/${destination.slug}` },
  };
}

export default function SearchPage() {
  return (
    // useSearchParams needs a Suspense boundary during prerender.
    <Suspense fallback={<SearchSkeleton />}>
      <SearchResults />
    </Suspense>
  );
}

function SearchSkeleton() {
  return (
    <div className="mx-auto max-w-shell px-4 py-6">
      <div className="skeleton mb-4 h-16 w-full rounded-card" />
      <div className="skeleton mb-4 h-7 w-56" />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index}>
            <ListingCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}
