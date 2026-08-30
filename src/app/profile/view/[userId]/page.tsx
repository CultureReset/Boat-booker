import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { getDb } from '@/lib/storage';
import { publicProfileFor } from '@/lib/services/memories';
import { PhotoFrame, SectionHeading, Stars } from '@/components/ui/primitives';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const db = await getDb();
  try {
    const profile = publicProfileFor(db, userId);
    return { title: profile.displayName };
  } catch {
    return { title: t('profile', 'notFound') };
  }
}

/**
 * A public profile.
 *
 * Shows only what the person has already made public: reviews they wrote are
 * already on listings, listings they run are already in search. Trips taken
 * appears as a count, never as a list — where someone has been is not public
 * information.
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const db = await getDb();

  let profile: ReturnType<typeof publicProfileFor>;
  try {
    profile = publicProfileFor(db, userId);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-800">
          {profile.displayName.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-ink">{profile.displayName}</h1>
          <p className="text-sm text-ink-muted">
            {t('profile', 'memberSince', { date: formatDate(profile.memberSince.slice(0, 10), 'medium') })}
          </p>
          <p className="text-sm text-ink-muted">
            {t('profile', 'tripsTaken', { count: profile.completedTrips })} ·{' '}
            {t('profile', 'reviewsWritten', { count: profile.reviewCount })}
          </p>
        </div>
      </header>

      {profile.bio ? (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
          {profile.bio}
        </p>
      ) : null}

      {profile.listings.length ? (
        <section className="mt-6">
          <SectionHeading title={t('profile', 'listingsTitle')} level={2} />
          <ul className="grid gap-3 sm:grid-cols-2">
            {profile.listings.map((listing) => (
              <li key={listing.id}>
                <Link
                  href={`/charters/view/${listing.id}`}
                  className="block overflow-hidden rounded-card border border-line bg-white"
                >
                  <PhotoFrame
                    photo={listing.photo}
                    rounded="rounded-none"
                    className="aspect-[16/10] w-full"
                  />
                  <span className="block truncate p-3 text-sm font-bold text-ink">
                    {listing.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {profile.reviews.length ? (
        <section className="mt-6">
          <SectionHeading title={t('profile', 'reviewsTitle')} level={2} />
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
            {profile.reviews.map((review) => (
              <li key={review.id} className="p-3">
                <Stars rating={review.rating} />
                <p className="mt-1 text-sm font-bold text-ink">{review.headline}</p>
                <Link
                  href={`/charters/view/${review.charterId}`}
                  className="text-xs text-ink-muted hover:underline"
                >
                  {review.charterTitle}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
