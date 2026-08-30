import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser, publicUser } from '@/lib/auth/session';
import { SectionHeading } from '@/components/ui/primitives';
import { ProfileForm } from '@/components/account/ProfileForm';

export const metadata: Metadata = { title: t('account', 'profileTitle') };

export default async function ProfilePage() {
  const user = (await currentUser())!;
  return (
    <>
      <SectionHeading title={t('account', 'profileTitle')} level={1} />
      <ProfileForm user={publicUser(user)} />
    </>
  );
}
