import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { SectionHeading } from '@/components/ui/primitives';
import { PayoutMethods } from '@/components/owner/PayoutMethods';

export const metadata: Metadata = { title: t('owner', 'payoutMethodsTitle') };

export default async function PayoutMethodsPage() {
  const user = (await currentUser())!;
  return (
    <>
      <SectionHeading title={t('owner', 'payoutMethodsTitle')} level={1} />
      <PayoutMethods
        methods={user.ownerProfile?.payoutMethods ?? []}
        defaultCurrency={user.currency}
      />
    </>
  );
}
