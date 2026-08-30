import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/primitives';
import { ItineraryEditor } from '@/components/owner/ItineraryEditor';

export const metadata: Metadata = { title: t('itinerary', 'title') };

/**
 * Itineraries for one listing.
 *
 * All the listing's trips load at once so switching between them is instant —
 * an operator writing itineraries is doing the same task repeatedly, and a
 * round trip per trip would make that unbearable.
 */
export default async function ItinerariesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;
  const db = await getDb();

  const charter = db.charters.find((c) => c.id === id && c.ownerId === user.id);
  if (!charter) notFound();

  const packages = db.packages
    .filter((p) => p.charterId === charter.id && p.active)
    .map((p) => ({
      id: p.id,
      title: p.title,
      hours: p.hours,
      // Multi-day trips need an itinerary per day.
      days: Math.max(1, Math.ceil(p.hours / 24)),
    }));

  const itineraries = db.itineraries
    .filter((i) => i.charterId === charter.id)
    .map((i) => ({
      id: i.id,
      packageId: i.packageId,
      status: i.status,
      days: i.days.map((day) => ({
        steps: day.steps.map((step) => ({
          title: step.title,
          description: step.description,
          durationMinutes: step.durationMinutes,
          isMeetingPoint: step.isMeetingPoint,
        })),
      })),
    }));

  return (
    <>
      <Link
        href={`/owner/listings/${charter.id}`}
        className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Icon name="chevron-left" size={15} />
        {charter.title}
      </Link>
      <SectionHeading title={t('itinerary', 'title')} subtitle={t('itinerary', 'subtitle')} level={1} />
      <ItineraryEditor charterId={charter.id} packages={packages} itineraries={itineraries} />
    </>
  );
}
