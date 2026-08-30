import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { SectionHeading } from '@/components/ui/primitives';
import { PaymentMethods } from '@/components/account/PaymentMethods';

export const metadata: Metadata = { title: t('account', 'paymentMethodsTitle') };

export default async function PaymentMethodsPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  const cards = db.cards
    .filter((card) => card.userId === user.id)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  return (
    <>
      <SectionHeading title={t('account', 'paymentMethodsTitle')} level={1} />
      <PaymentMethods cards={cards} />
    </>
  );
}
