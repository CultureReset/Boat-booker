'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { formatMoney } from '@/lib/core/money';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  Toggle,
} from '@/components/ui/primitives';
import type { AddOn } from '@/lib/domain/types';

/**
 * Paid extras on a listing.
 *
 * Retired add-ons stay visible to the operator rather than disappearing: a
 * booking still references them, and an operator wondering why last month's
 * receipts mention "Onboard lunch" deserves to find it here.
 */
export function AddOnEditor({
  charterId,
  currency,
  capacity,
  addOns: initial,
}: {
  charterId: string;
  currency: string;
  capacity: number;
  addOns: AddOn[];
}) {
  const router = useRouter();

  const [addOns, setAddOns] = useState(initial);
  const [editing, setEditing] = useState<Partial<AddOn> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await api.post<AddOn>(`/api/owner/listings/${charterId}/add-ons`, editing);
      setAddOns((current) => {
        const without = current.filter((a) => a.id !== saved.id);
        return [...without, saved].sort((a, b) => a.title.localeCompare(b.title));
      });
      setEditing(null);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (addOn: AddOn) => {
    setBusy(true);
    try {
      const result = await api.post<{ outcome: 'deleted' | 'retired' }>(
        `/api/owner/listings/${charterId}/add-ons`,
        { id: addOn.id, remove: true },
      );
      if (result.outcome === 'retired') {
        setAddOns((current) =>
          current.map((a) => (a.id === addOn.id ? { ...a, active: false } : a)),
        );
        setNotice(t('addOns', 'retired'));
      } else {
        setAddOns((current) => current.filter((a) => a.id !== addOn.id));
      }
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {addOns.length === 0 ? (
        <EmptyState icon="plus" title={t('addOns', 'emptyTitle')} body={t('addOns', 'emptyBody')} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
          {addOns.map((addOn) => (
            <li key={addOn.id} className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-2 text-sm font-bold text-ink">
                  {addOn.title}
                  {!addOn.active ? <Badge tone="neutral">{t('owner', 'inactive')}</Badge> : null}
                </p>
                <p className="text-xs text-ink-muted">{addOn.description}</p>
                <p className="mt-0.5 text-xs font-semibold text-ink-soft">
                  {formatMoney(addOn.price, addOn.currency)}{' '}
                  {t('addOns', addOn.pricing === 'per_person' ? 'perPerson' : 'perBooking')}
                </p>
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(addOn)}
                  aria-label={t('general', 'edit')}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-surface-sunken"
                >
                  <Icon name="edit" size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(addOn)}
                  disabled={busy}
                  aria-label={t('general', 'delete')}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-danger hover:bg-danger/5"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {notice ? <p className="text-xs text-ink-muted">{notice}</p> : null}

      <Button
        variant="secondary"
        onClick={() =>
          setEditing({ pricing: 'per_person', maxQuantity: capacity, active: true, currency })
        }
      >
        <Icon name="plus" size={15} />
        {t('addOns', 'addAddOn')}
      </Button>

      <Overlay
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t('addOns', editing?.id ? 'editAddOn' : 'addAddOn')}
      >
        {editing ? (
          <div className="space-y-3">
            <Field label={t('addOns', 'name')}>
              {({ id }) => (
                <Input
                  id={id}
                  value={editing.title ?? ''}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder={t('addOns', 'namePlaceholder')}
                />
              )}
            </Field>

            <Field label={t('addOns', 'description')}>
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={editing.description ?? ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder={t('addOns', 'descriptionPlaceholder')}
                />
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('addOns', 'price')}>
                {({ id }) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={editing.price ?? ''}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                  />
                )}
              </Field>
              <Field label={t('addOns', 'pricingModel')}>
                {({ id }) => (
                  <Select
                    id={id}
                    value={editing.pricing ?? 'per_person'}
                    onChange={(e) =>
                      setEditing({ ...editing, pricing: e.target.value as AddOn['pricing'] })
                    }
                  >
                    <option value="per_person">{t('addOns', 'perPerson')}</option>
                    <option value="per_booking">{t('addOns', 'perBooking')}</option>
                  </Select>
                )}
              </Field>
            </div>

            <Toggle
              label={t('addOns', 'active')}
              checked={editing.active !== false}
              onChange={(next) => setEditing({ ...editing, active: next })}
            />

            {error ? (
              <p role="alert" className="text-sm font-semibold text-danger">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>
                {t('general', 'cancel')}
              </Button>
              <Button className="flex-1" disabled={busy} onClick={submit}>
                {t('general', 'save')}
              </Button>
            </div>
          </div>
        ) : null}
      </Overlay>
    </div>
  );
}
