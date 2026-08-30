import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { SectionHeading } from '@/components/ui/primitives';
import { WidgetBuilder } from '@/components/owner/WidgetBuilder';

export const metadata: Metadata = { title: t('owner', 'widgetsTitle') };

/** Embed codes so an owner can take bookings from their own website. */
export default async function WidgetsPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  const listings = db.charters
    .filter((charter) => charter.ownerId === user.id && charter.published)
    .map((charter) => ({ id: charter.id, title: charter.title }));

  return (
    <>
      <SectionHeading title={t('owner', 'widgetsTitle')} subtitle={t('owner', 'widgetsBody')} level={1} />
      <WidgetBuilder listings={listings} origin={`https://${brand.domain}`} />
    </>
  );
}
