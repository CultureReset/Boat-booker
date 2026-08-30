'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { formatMoney } from '@/lib/core/money';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Button, Field, Input } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Tipping.
 *
 * Presets carry both the percentage and the money, because "20%" means nothing
 * to someone deciding on a dock and "$90" means everything. The custom field is
 * bounded server-side too — this is a courtesy, not the guard.
 */

export interface TipData {
  bookingId: string;
  reference: string;
  date: string;
  tripPrice: number;
  currency: string;
  enabled: boolean;
  presets: { percent: number; amount: number }[];
  minAmount: number;
  maxAmount: number;
  captainName: string;
  alreadyTipped: boolean;
}

export function TipFlow({ data }: { data: TipData }) {
  const router = useRouter();

  const [selected, setSelected] = useState<number | 'custom' | null>(null);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const bookingHref = `/account/bookings/${data.bookingId}`;

  if (!data.enabled) {
    return (
      <Outcome
        icon="info"
        title={t('pay', 'tipDisabledTitle')}
        body={t('pay', 'tipDisabledBody')}
        href={bookingHref}
      />
    );
  }

  if (done || data.alreadyTipped) {
    return (
      <Outcome
        icon="check-circle"
        tone="success"
        title={t('pay', 'tipThanksTitle')}
        body={
          data.alreadyTipped && !done
            ? t('pay', 'alreadyTipped')
            : t('pay', 'tipThanksBody', { captain: data.captainName })
        }
        href={bookingHref}
      />
    );
  }

  const amount =
    selected === 'custom' ? Number(custom) || 0 : typeof selected === 'number' ? selected : 0;

  const tooLow = amount > 0 && amount < data.minAmount;
  const tooHigh = amount > data.maxAmount;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/payments', { action: 'tip', bookingId: data.bookingId, amount });
      setDone(true);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-card border border-line bg-white p-4">
      <h1 className="text-lg font-bold text-ink">{t('pay', 'tipTitle')}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {t('pay', 'tipDescription', {
          price: formatMoney(data.tripPrice, data.currency),
          captain: data.captainName,
        })}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {data.presets.map((preset) => (
          <button
            key={preset.percent}
            type="button"
            onClick={() => setSelected(preset.amount)}
            aria-pressed={selected === preset.amount}
            className={cx(
              'rounded-lg border py-3 text-center transition-colors',
              selected === preset.amount
                ? 'border-accent bg-accent-50'
                : 'border-line hover:bg-surface-sunken',
            )}
          >
            <span className="block text-base font-bold text-ink">{preset.percent}%</span>
            <span className="block text-xs text-ink-muted">
              {formatMoney(preset.amount, data.currency)}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSelected('custom')}
          aria-pressed={selected === 'custom'}
          className={cx(
            'rounded-lg border py-2.5 text-sm font-semibold transition-colors',
            selected === 'custom'
              ? 'border-accent bg-accent-50 text-ink'
              : 'border-line text-ink-soft hover:bg-surface-sunken',
          )}
        >
          {t('pay', 'customTip')}
        </button>
        <Link
          href={bookingHref}
          className="rounded-lg border border-line py-2.5 text-center text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-sunken"
        >
          {t('pay', 'noTip')}
        </Link>
      </div>

      {selected === 'custom' ? (
        <Field
          label={t('pay', 'customTipLabel')}
          className="mt-3"
          hint={t('pay', 'customTipHint', { min: '5', max: '50' })}
          error={
            tooLow
              ? t('pay', 'tipTooLow', { min: '5' })
              : tooHigh
                ? t('pay', 'tipTooHigh', { max: '50' })
                : undefined
          }
        >
          {({ id, invalid }) => (
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              min={data.minAmount}
              max={data.maxAmount}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              invalid={invalid}
            />
          )}
        </Field>
      ) : null}

      <p className="mt-3 text-xs text-ink-muted">{t('pay', 'tipNotIncluded')}</p>

      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <Button
        className="mt-4 w-full bg-accent hover:bg-accent-600"
        disabled={busy || amount <= 0 || tooLow || tooHigh}
        onClick={submit}
      >
        {amount > 0
          ? `${t('pay', 'payTip')} · ${formatMoney(amount, data.currency)}`
          : t('pay', 'payTip')}
      </Button>
    </div>
  );
}

export function Outcome({
  icon,
  tone = 'neutral',
  title,
  body,
  href,
  action,
}: {
  icon: 'check-circle' | 'alert' | 'info' | 'clock';
  tone?: 'neutral' | 'success' | 'danger';
  title: string;
  body: string;
  href?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-white p-6 text-center">
      <span
        className={cx(
          'mx-auto flex h-12 w-12 items-center justify-center rounded-full',
          tone === 'success'
            ? 'bg-success/10 text-success'
            : tone === 'danger'
              ? 'bg-danger/10 text-danger'
              : 'bg-surface-sunken text-ink-soft',
        )}
      >
        <Icon name={icon} size={26} />
      </span>
      <h1 className="mt-3 text-lg font-bold text-ink">{title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{body}</p>
      {action}
      {href ? (
        <Link
          href={href}
          className="mt-4 inline-block rounded-control bg-brand-600 px-5 py-2.5 text-sm font-bold text-white"
        >
          {t('changeBooking', 'backToBooking')}
        </Link>
      ) : null}
    </div>
  );
}
