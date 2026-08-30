import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { describe, isExpired } from '@/lib/domain/paymentMethods';
import { PaymentError, processingFeeFor, resolvePaymentToken } from '@/lib/services/payments';
import { BalanceFlow } from '@/components/payments/BalanceFlow';
import { Outcome } from '@/components/payments/TipFlow';

export const metadata: Metadata = {
  title: t('pay', 'balanceTitle'),
  robots: { index: false, follow: false },
};

/**
 * Settle a remaining balance from a link.
 *
 * Open to signed-out visitors — the token is the credential. Expired and
 * unknown tokens get distinct pages, because "you waited too long" and "this
 * was never yours" need different next steps.
 */
export default async function PayBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const db = await getDb();

  if (!token) {
    return (
      <Shell>
        <Outcome
          icon="alert"
          tone="danger"
          title={t('pay', 'accessDeniedTitle')}
          body={t('pay', 'accessDeniedBody')}
        />
      </Shell>
    );
  }

  try {
    const context = resolvePaymentToken(db, token);
    const viewer = await currentUser();

    // The saved method is only surfaced to the account that owns it — a
    // forwarded link must not reveal someone else's way of paying.
    const method =
      viewer?.id === context.booking.customerId
        ? db.paymentMethods.find((c) => c.id === context.booking.paymentMethodId) ??
          db.paymentMethods.find((c) => c.userId === viewer.id && c.isDefault)
        : undefined;

    return (
      <Shell>
        <BalanceFlow
          data={{
            bookingId: context.booking.id,
            reference: context.booking.reference,
            date: context.booking.date,
            outstanding: context.booking.balance.outstanding,
            currency: context.booking.currency,
            charterTitle: context.charter?.title ?? '',
            captainName: context.captainName,
          }}
          token={token}
          savedCard={method ? { ...describe(method), expired: isExpired(method) } : null}
          processingFee={processingFeeFor(context.charter, context.booking.balance.outstanding)}
        />
      </Shell>
    );
  } catch (error) {
    const code = error instanceof PaymentError ? error.code : 'not_found';
    return (
      <Shell>
        {code === 'expired' ? (
          <Outcome
            icon="clock"
            title={t('pay', 'sessionExpiredTitle')}
            body={t('pay', 'sessionExpiredBody')}
          />
        ) : code === 'already_paid' ? (
          <Outcome
            icon="check-circle"
            tone="success"
            title={t('pay', 'paymentSuccessTitle')}
            body={t('pay', 'paymentSuccessBody')}
          />
        ) : (
          <Outcome
            icon="alert"
            tone="danger"
            title={t('pay', 'accessDeniedTitle')}
            body={t('pay', 'accessDeniedBody')}
          />
        )}
      </Shell>
    );
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="guest" className="mx-auto w-full max-w-lg px-4 py-6">
      {children}
    </div>
  );
}
