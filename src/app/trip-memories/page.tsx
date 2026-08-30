import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { memoriesFor } from '@/lib/services/memories';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, PhotoFrame, SectionHeading } from '@/components/ui/primitives';

export const metadata: Metadata = { title: t('memories', 'indexTitle') };

export default async function TripMemoriesPage() {
  const user = (await currentUser())!;
  const db = await getDb();
  const bookings = memoriesFor(db, user.id);

  return (
    <div className="mx-auto w-full max-w-shell px-4 py-6">
      <SectionHeading
        title={t('memories', 'indexTitle')}
        subtitle={t('memories', 'indexSubtitle')}
        level={1}
      />

      {bookings.length === 0 ? (
        <EmptyState
          icon="star"
          title={t('memories', 'emptyTitle')}
          body={t('memories', 'emptyBody')}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bookings.map((booking) => {
            const charter = db.charters.find((c) => c.id === booking.charterId);
            return (
              <li key={booking.id}>
                <Link
                  href={`/trip-memory/${booking.id}`}
                  className="group block overflow-hidden rounded-card border border-line bg-white"
                >
                  <span className="relative block">
                    <PhotoFrame
                      photo={charter?.photos[0] ?? null}
                      rounded="rounded-none"
                      className="aspect-[16/10] w-full"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/25 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-700">
                        <Icon name="arrow-right" size={20} />
                      </span>
                    </span>
                  </span>
                  <span className="block p-3">
                    <span className="block truncate text-sm font-bold text-ink">
                      {charter?.title ?? booking.reference}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {formatDate(booking.date, 'medium')}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
