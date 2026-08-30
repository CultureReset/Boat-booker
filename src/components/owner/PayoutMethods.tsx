'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { currencies } from '@/config/locale';
import { translate as t } from '@/i18n/translate';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/providers/ToastProvider';
import type { PayoutMethod } from '@/lib/domain/types';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog, Overlay } from '@/components/ui/Overlay';
import { Badge, Button, EmptyState, Field, Input, Select } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Payout methods.
 *
 * Like saved cards, the account number is submitted once and only the last
 * four characters are kept.
 */
export function PayoutMethods({
  methods: initial,
  defaultCurrency,
}: {
  methods: PayoutMethod[];
  defaultCurrency: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [methods, setMethods] = useState(initial);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<PayoutMethod | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/owner/payouts?methodId=${removeTarget.id}`);
      setMethods((current) => current.filter((m) => m.id !== removeTarget.id));
      setRemoveTarget(null);
      toast(t('general', 'remove'), 'success');
      router.refresh();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl">
      {methods.length === 0 ? (
        <EmptyState
          icon="wallet"
          title={t('owner', 'addPayoutMethod')}
          body={t('owner', 'payoutMethodsEmptyBody')}
          action={<Button icon="plus" onClick={() => setAddOpen(true)}>{t('owner', 'addPayoutMethod')}</Button>}
        />
      ) : (
        <>
          <ul className="space-y-2">
            {methods.map((method) => (
              <li key={method.id} className="flex items-center gap-3 rounded-card border border-line bg-white p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken">
                  <Icon name={method.kind === 'paypal' ? 'globe' : 'wallet'} size={18} className="text-ink-soft" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {method.label}
                    {method.isDefault ? <Badge tone="brand">{t('account', 'defaultCard')}</Badge> : null}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {method.accountHolder} · •••• {method.last4} · {method.currency}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setRemoveTarget(method)}
                  aria-label={t('general', 'remove')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-danger"
                >
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>

          <Button className="mt-4" variant="outline" icon="plus" onClick={() => setAddOpen(true)}>
            {t('owner', 'addPayoutMethod')}
          </Button>
        </>
      )}

      <AddMethodDialog
        open={addOpen}
        defaultCurrency={defaultCurrency}
        onClose={() => setAddOpen(false)}
        onAdded={(method) => {
          setMethods((current) => [...current, method]);
          setAddOpen(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={remove}
        loading={busy}
        title={t('general', 'remove')}
        confirmLabel={t('general', 'remove')}
        body={removeTarget ? <p>{removeTarget.label} · •••• {removeTarget.last4}</p> : null}
      />
    </div>
  );
}

function AddMethodDialog({
  open,
  defaultCurrency,
  onClose,
  onAdded,
}: {
  open: boolean;
  defaultCurrency: string;
  onClose: () => void;
  onAdded: (method: PayoutMethod) => void;
}) {
  const { toast } = useToast();

  const [kind, setKind] = useState<'bank' | 'paypal'>('bank');
  const [label, setLabel] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = accountHolder.trim().length > 1 && accountNumber.replace(/\s/g, '').length >= 4;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const method = await api.post<PayoutMethod>('/api/owner/payouts', {
        kind,
        label,
        accountHolder,
        accountNumber,
        currency,
      });
      toast(t('account', 'savedSuccess'), 'success');
      setLabel('');
      setAccountHolder('');
      setAccountNumber('');
      onAdded(method);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={t('owner', 'addPayoutMethod')}
      size="sm"
      footer={
        <Button fullWidth onClick={submit} loading={busy} disabled={!valid}>
          {t('general', 'save')}
        </Button>
      }
    >
      {error ? (
        <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-ink">{t('owner', 'payoutMethodsTitle')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['bank', 'paypal'] as const).map((option) => (
              <label
                key={option}
                className={cx(
                  'flex cursor-pointer items-center gap-2 rounded-control border p-3 transition-colors',
                  kind === option ? 'border-brand-600 bg-brand-50/50' : 'border-line',
                )}
              >
                <input
                  type="radio"
                  name="payout_kind"
                  checked={kind === option}
                  onChange={() => setKind(option)}
                  className="h-4 w-4 border-line text-brand-600"
                />
                <span className="text-sm font-semibold text-ink">
                  {option === 'bank' ? t('owner', 'payoutMethodBank') : t('owner', 'payoutMethodPaypal')}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={t('owner', 'payoutLabelName')} hint={t('owner', 'payoutLabelHint')}>
          {({ id }) => <Input id={id} value={label} onChange={(e) => setLabel(e.target.value)} />}
        </Field>

        <Field label={t('owner', 'accountHolder')} required>
          {({ id }) => (
            <Input id={id} value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
          )}
        </Field>

        <Field
          label={kind === 'bank' ? t('owner', 'accountNumber') : t('login', 'email')}
          required
        >
          {({ id }) => (
            <Input
              id={id}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              inputMode={kind === 'bank' ? 'numeric' : 'email'}
            />
          )}
        </Field>

        <Field label={t('owner', 'payoutCurrency')}>
          {({ id }) => (
            <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name} ({item.code})
                </option>
              ))}
            </Select>
          )}
        </Field>

        <p className="flex items-start gap-1.5 text-xs text-ink-muted">
          <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
          {t('owner', 'payoutStorageNote')}
        </p>
      </div>
    </Overlay>
  );
}
