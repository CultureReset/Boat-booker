import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser, publicUser } from '@/lib/auth/session';
import { SectionHeading } from '@/components/ui/primitives';
import { OwnerSettings } from '@/components/owner/OwnerSettings';

export const metadata: Metadata = { title: t('owner', 'settingsTitle') };

export default async function OwnerSettingsPage() {
  const user = (await currentUser())!;
  return (
    <>
      <SectionHeading title={t('owner', 'settingsTitle')} level={1} />
      <OwnerSettings user={publicUser(user)} />
    </>
  );
}
