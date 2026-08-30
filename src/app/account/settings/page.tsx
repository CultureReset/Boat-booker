import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser, publicUser } from '@/lib/auth/session';
import { SectionHeading } from '@/components/ui/primitives';
import { SettingsPanel } from '@/components/account/SettingsPanel';

export const metadata: Metadata = { title: t('account', 'settingsTitle') };

export default async function SettingsPage() {
  const user = (await currentUser())!;
  return (
    <>
      <SectionHeading title={t('account', 'settingsTitle')} level={1} />
      <SettingsPanel user={publicUser(user)} />
    </>
  );
}
