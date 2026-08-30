'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { formatMoney } from '@/lib/core/money';
import { api, errorMessage } from '@/lib/client/api';
import { Button, Radio } from '@/components/ui/primitives';
import { Outcome } from './TipFlow';

/**
 * Settle the remaining balance from a link.
 *
 * No session is required — the link is the credential — so the page shows only
 * what the token already proves: the reference, the date, and the amount. It
 * deliberately does not show the guest's contact details or the operator's,
 * because a forwarded link should not leak either.
 */

export interface BalanceData {
  bookingId: string;
  reference: string;
  date: string;
  outstanding: number;
  currency: string;
  charterTitle: string;
  captainName: string;
}

export function BalanceFlow({
  data,
  token,
  savedCard,
  processingFee,
}: {
  data: BalanceData;
  token: string;
  /** `title` names the instrument, `detail` says which one — see domain/paymentMethods. */
  savedCard: { title: string; detail: string; expired: boolean } | null;
  processingFee: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<'paid' | 'card_expired' | null>(null);

  const total = data.outstanding + processingFee;

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/payments', {
        action: 'pay_balance',
        token,
        cardExpired: savedCard?.expired ?? false,
      });
      setResult('paid');
      router.refresh();
    } catch (caught) {
      if ((caught as { code?: string })?.code === 'card_expired') setResult('card_expired');
      else setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (result === 'paid') {
    return (
      <Outcome
        icon="check-circle"
        tone="success"
        title={t('pay', 'paymentSuccessTitle')}
        body={t('pay', 'paymentSuccessBody')}
      />
    );
  }

  if (result === 'card_expired') {
    return (
      <Outcome
        icon="alert"
        tone="danger"
        title={t('pay', 'paymentFailedTitle')}
        body={t('pay', 'paymentFailedBody')}
        action={
          <Button className="mt-4" onClick={() => setResult(null)}>
            {t('pay', 'tryAgain')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="rounded-card border border-line bg-white p-4">
      <h1 className="text-lg font-bold text-ink">{t('pay', 'balanceTitle')}</h1>
      <p className="mt-0.5 text-sm text-ink-muted">
        {data.charterTitle} · {formatDate(data.date, 'medium')} · {data.reference}
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        {t('pay', 'requestedByCaptain', { captain: data.captainName })}
      </p>

      <dl className="mt-4 space-y-2 rounded-lg bg-surface-sunken p-3 text-sm">
        <Row label={t('pay', 'remainingBalance')} value={formatMoney(data.outstanding, data.currency)} />
        {processingFee > 0 ? (
          <Row label={t('pay', 'processingFee')} value={formatMoney(processingFee, data.currency)} />
        ) : null}
        <div className="border-t border-line pt-2">
          <Row
            label={t('pay', 'totalToPay')}
            value={formatMoney(total, data.currency)}
            strong
          />
        </div>
      </dl>

      {savedCard ? (
        <p className="mt-3 text-sm text-ink-soft">
          {t('pay', 'savedPaymentMethod')}{' '}
          <span className="font-semibold text-ink">
            {savedCard.title}{savedCard.detail ? ` ${savedCard.detail}` : ''}
          </span>
        </p>
      ) : null}

      <p className="mt-3 text-xs text-ink-muted">{t('pay', 'amountNonRefundable')}</p>

      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <Button className="mt-4 w-full" disabled={busy} onClick={pay}>
        {busy ? t('pay', 'confirming') : t('pay', 'confirmAndPay')}
      </Button>
    </div>
  );
}

/**
 * How the guest wants the balance collected.
 *
 * Rendered on the booking detail page rather than at checkout: the decision
 * only becomes real once the trip is confirmed, and offering it earlier means
 * asking someone to plan a payment for a booking they might not get.
 */
export function BalanceCollection({
  bookingId,
  mode,
  outstanding,
  currency,
  scheduledFor,
}: {
  bookingId: string;
  mode: 'direct_to_operator' | 'online_anytime' | 'scheduled';
  outstanding: number;
  currency: string;
  scheduledFor?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(mode);

  if (outstanding <= 0) return null;

  const choose = async (next: typeof mode) => {
    setCurrent(next);
    setBusy(true);
    try {
      await api.post('/api/payments', { action: 'schedule', bookingId, mode: next });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const options = [
    { key: 'direct_to_operator' as const, label: t('pay', 'collectDirect'), body: t('pay', 'collectDirectBody') },
    { key: 'online_anytime' as const, label: t('pay', 'collectOnline'), body: t('pay', 'collectOnlineBody') },
    {
      key: 'scheduled' as const,
      label: t('pay', 'collectScheduled'),
      body: t('pay', 'collectScheduledBody', { amount: formatMoney(outstanding, currency) }),
    },
  ];

  return (
    <section className="rounded-card border border-line bg-white p-4">
      <h2 className="text-sm font-bold text-ink">{t('pay', 'collectionTitle')}</h2>
      <div className="mt-2 space-y-1">
        {options.map((option) => (
          <Radio
            key={option.key}
            name="balance-mode"
            label={option.label}
            sublabel={option.body}
            checked={current === option.key}
            disabled={busy}
            onChange={() => choose(option.key)}
          />
        ))}
      </div>
      {current === 'scheduled' && scheduledFor ? (
        <p className="mt-2 text-xs font-semibold text-ink-soft">
          {t('pay', 'scheduledOn', { date: formatDate(scheduledFor, 'medium') })}
        </p>
      ) : null}
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? 'text-sm font-bold text-ink' : 'text-xs text-ink-muted'}>{label}</dt>
      <dd className={strong ? 'text-base font-bold text-ink' : 'text-sm text-ink'}>{value}</dd>
    </div>
  );
}
