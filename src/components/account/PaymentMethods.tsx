'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/providers/ToastProvider';
import type { PaymentMethod, PaymentMethodKind } from '@/lib/domain/types';
import { describe, iconFor } from '@/lib/domain/paymentMethods';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog, Overlay } from '@/components/ui/Overlay';
import { Badge, Button, EmptyState, Field, Input } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Saved ways to pay — cards and wallets in one list.
 *
 * One list rather than a section per kind, because the only question checkout
 * asks is which one is the default, and that is a single choice across all of
 * them. A card's number is sent once, validated server-side and discarded; a
 * wallet has no number, only the account it links to.
 */
export function PaymentMethods({ cards: initial }: { cards: PaymentMethod[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [cards, setCards] = useState(initial);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<PaymentMethod | null>(null);
  const [addKind, setAddKind] = useState<PaymentMethodKind>('card');
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/cards?id=${removeTarget.id}`);
      setCards((current) => current.filter((c) => c.id !== removeTarget.id));
      toast(t('account', 'removeCard'), 'success');
      setRemoveTarget(null);
      router.refresh();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (cardId: string) => {
    try {
      await api.patch('/api/cards', { cardId });
      setCards((current) => current.map((c) => ({ ...c, isDefault: c.id === cardId })));
      toast(t('account', 'savedSuccess'), 'success');
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    }
  };

  return (
    <div className="max-w-xl">
      {cards.length === 0 ? (
        <EmptyState
          icon="card"
          title={t('account', 'paymentMethodsEmpty')}
          action={
            <Button
              onClick={() => {
                setAddKind('card');
                setAddOpen(true);
              }}
              icon="plus"
            >
              {t('account', 'addCard')}
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {cards.map((card) => (
              <li
                key={card.id}
                className="flex items-center gap-3 rounded-card border border-line bg-white p-3"
              >
                <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded bg-surface-sunken">
                  <Icon name={iconFor(card)} size={20} className="text-ink-soft" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="truncate">
                      {describe(card).title} {describe(card).detail}
                    </span>
                    {card.isDefault ? <Badge tone="brand">{t('account', 'defaultCard')}</Badge> : null}
                  </p>
                  {/* A card says when it runs out; a wallet has nothing to say. */}
                  {card.kind === 'card' && card.expMonth && card.expYear ? (
                    <p className="text-xs text-ink-muted">
                      {t('account', 'expires', {
                        month: String(card.expMonth).padStart(2, '0'),
                        year: String(card.expYear).slice(-2),
                      })}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 gap-1">
                  {!card.isDefault ? (
                    <button
                      type="button"
                      onClick={() => makeDefault(card.id)}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      {t('account', 'makeDefault')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(card)}
                    aria-label={t('account', 'removeCard')}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-danger"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <AddButtons
            onPick={(kind) => {
              setAddKind(kind);
              setAddOpen(true);
            }}
            existing={cards}
          />
        </>
      )}

      <AddMethodDialog
        open={addOpen}
        kind={addKind}
        onClose={() => setAddOpen(false)}
        onAdded={(card) => {
          setCards((current) => [...current.map((c) => ({ ...c, isDefault: card.isDefault ? false : c.isDefault })), card]);
          setAddOpen(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={remove}
        loading={busy}
        title={t('account', 'removeCard')}
        confirmLabel={t('general', 'remove')}
        body={
          removeTarget ? (
            <p>
              {describe(removeTarget).title} {describe(removeTarget).detail}
            </p>
          ) : null
        }
      />
    </div>
  );
}

/**
 * The row of ways to add a method.
 *
 * A wallet is offered only while it is not already linked: one PayPal account
 * per person is the whole of it, and a second button would open a dialog whose
 * only outcome is re-linking the same wallet.
 */
function AddButtons({
  onPick,
  existing,
}: {
  onPick: (kind: PaymentMethodKind) => void;
  existing: PaymentMethod[];
}) {
  const has = (kind: PaymentMethodKind) => existing.some((m) => m.kind === kind);

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button variant="outline" icon="plus" onClick={() => onPick('card')}>
        {t('account', 'addCard')}
      </Button>
      {!has('paypal') ? (
        <Button variant="outline" icon="wallet" onClick={() => onPick('paypal')}>
          {t('account', 'addPaypal')}
        </Button>
      ) : null}
      {!has('apple_pay') ? (
        <Button variant="outline" icon="phone" onClick={() => onPick('apple_pay')}>
          {t('account', 'addApplePay')}
        </Button>
      ) : null}
    </div>
  );
}

function AddMethodDialog({
  open,
  kind,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (method: PaymentMethod) => void;
  kind: PaymentMethodKind;
}) {
  const { toast } = useToast();

  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCard = kind === 'card';
  const digits = number.replace(/\D/g, '');
  const [month, year] = expiry.split('/');
  const valid = isCard
    ? digits.length >= 13 && /^\d{2}\/\d{2}$/.test(expiry)
    : accountLabel.trim().length > 0;

  const title = isCard
    ? t('account', 'addCard')
    : kind === 'paypal'
      ? t('account', 'addPaypal')
      : t('account', 'addApplePay');

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const method = await api.post<PaymentMethod>('/api/cards', {
        kind,
        ...(isCard
          ? {
              number: digits,
              expMonth: Number(month),
              // Two-digit years are stored as full years so comparisons stay simple.
              expYear: 2000 + Number(year),
            }
          : { accountLabel: accountLabel.trim() }),
        makeDefault,
      });
      toast(t('account', 'savedSuccess'), 'success');
      setNumber('');
      setExpiry('');
      setAccountLabel('');
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
      title={title}
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
        {/* A wallet has one field — which account it links to. Everything the
            card path asks for (number, expiry, Luhn) has no counterpart. */}
        {!isCard ? (
          <Field
            label={kind === 'paypal' ? t('account', 'paypalEmail') : t('account', 'applePayDevice')}
            hint={kind === 'paypal' ? t('account', 'paypalEmailHint') : t('account', 'applePayDeviceHint')}
            required
          >
            {({ id }) => (
              <Input
                id={id}
                type={kind === 'paypal' ? 'email' : 'text'}
                autoComplete={kind === 'paypal' ? 'email' : 'off'}
                placeholder={
                  kind === 'paypal'
                    ? t('account', 'paypalEmailPlaceholder')
                    : t('account', 'applePayDevicePlaceholder')
                }
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
                maxLength={120}
              />
            )}
          </Field>
        ) : null}

        {isCard ? (
        <>
        <Field label={t('booking', 'cardNumber')} required>
          {({ id }) => (
            <Input
              id={id}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4242 4242 4242 4242"
              value={number}
              onChange={(e) =>
                setNumber(e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim())
              }
              maxLength={23}
            />
          )}
        </Field>

        <Field label={t('booking', 'cardExpiry')} required>
          {({ id }) => (
            <Input
              id={id}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
                setExpiry(raw.length <= 2 ? raw : `${raw.slice(0, 2)}/${raw.slice(2)}`);
              }}
              maxLength={5}
            />
          )}
        </Field>
        </>
        ) : null}

        <label className={cx('flex cursor-pointer items-center gap-2.5 text-sm text-ink')}>
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
            className="h-5 w-5 rounded border-line text-brand-600"
          />
          {t('account', 'makeDefault')}
        </label>

        <p className="flex items-start gap-1.5 text-xs text-ink-muted">
          <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
          {isCard ? t('account', 'cardStorageNote') : t('account', 'walletStorageNote')}
        </p>
      </div>
    </Overlay>
  );
}
