import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { directEconomics, directSettingsFor } from '@/lib/services/direct';
import { SectionHeading } from '@/components/ui/primitives';
import { DirectPanel } from '@/components/owner/DirectPanel';

export const metadata: Metadata = { title: t('direct', 'title', { brand: brand.name }) };

/**
 * The operator's Direct console.
 *
 * The absolute origin is read from the request headers so the QR code and the
 * shareable link work wherever the app is deployed — a code printed with a
 * hardcoded domain is a code that stops working on the first redeploy.
 */
export default async function OwnerDirectPage() {
  const user = (await currentUser())!;
  const db = await getDb();
  const requestHeaders = await headers();

  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost:3000';
  const proto = requestHeaders.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const origin = `${proto}://${host}`;

  const settings = directSettingsFor(db, user.id) ?? null;

  const listings = db.charters
    .filter((c) => c.ownerId === user.id)
    .map((charter) => ({
      id: charter.id,
      title: charter.title,
      currency: charter.currency,
      packages: db.packages
        .filter((p) => p.charterId === charter.id && p.active)
        .map((p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
          departureTimes: p.departureTimes,
        })),
    }));

  const latestInvite =
    db.bookingInvites
      .filter((i) => i.ownerId === user.id && i.expiresAt > new Date().toISOString())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

  return (
    <>
      <SectionHeading
        title={t('direct', 'title', { brand: brand.name })}
        subtitle={t('direct', 'heroBody')}
        level={1}
      />
      <DirectPanel
        settings={settings}
        listings={listings}
        economics={directEconomics(1000, 'USD')}
        origin={origin}
        hasPayoutMethod={(user.ownerProfile?.payoutMethods.length ?? 0) > 0}
        latestInvite={latestInvite ? { token: latestInvite.token, channel: latestInvite.channel } : null}
      />
    </>
  );
}
