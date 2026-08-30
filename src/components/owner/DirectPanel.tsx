'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { formatMoney } from '@/lib/core/money';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  Input,
  Radio,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { QrCode } from '@/components/ui/QrCode';
import { cx } from '@/components/ui/cx';
import type { DirectSettings, InviteChannel } from '@/lib/domain/types';

/**
 * Direct — enable it, share it, and record the bookings it brings in.
 *
 * The economics panel leads because it is the only question an operator
 * actually has: what do I keep? Showing the marketplace equivalent beside it
 * turns an abstract fee rate into a comparison they can act on.
 */

export interface DirectListing {
  id: string;
  title: string;
  currency: string;
  packages: { id: string; title: string; price: number; departureTimes: string[] }[];
}

export interface DirectEconomics {
  processingFee: number;
  operatorReceives: number;
  marketplaceEquivalent: number;
  saved: number;
}

export function DirectPanel({
  settings: initial,
  listings,
  economics,
  origin,
  hasPayoutMethod,
  latestInvite,
}: {
  settings: DirectSettings | null;
  listings: DirectListing[];
  economics: DirectEconomics;
  origin: string;
  hasPayoutMethod: boolean;
  latestInvite: { token: string; channel: InviteChannel } | null;
}) {
  const router = useRouter();

  const [settings, setSettings] = useState(initial);
  const [showTerms, setShowTerms] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [feeBearer, setFeeBearer] = useState<'operator' | 'customer'>(
    initial?.feeBearer ?? 'operator',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [inviteChannel, setInviteChannel] = useState<InviteChannel>('qr');
  const [inviteListing, setInviteListing] = useState(listings[0]?.id ?? '');
  const [recipient, setRecipient] = useState('');
  const [inviteToken, setInviteToken] = useState(latestInvite?.token ?? '');
  const [showManual, setShowManual] = useState(false);

  const enabled = Boolean(settings?.enabled);
  const inviteUrl = inviteToken ? `${origin}/direct?invite=${inviteToken}` : '';

  const call = async (payload: Record<string, unknown>, onDone?: (result: unknown) => void) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.post('/api/owner/direct', payload);
      onDone?.(result);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------- economics */}
      <section className="rounded-card border border-line bg-white p-4">
        <h2 className="text-sm font-bold text-ink">{t('direct', 'economicsTitle')}</h2>
        <p className="text-xs text-ink-muted">
          {t('direct', 'perThousand', { amount: formatMoney(1000, 'USD') })}
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-success/30 bg-success/5 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-success">
              {t('direct', 'economicsOnDirect')}
            </p>
            <p className="mt-1 text-xl font-bold text-ink">
              {formatMoney(economics.operatorReceives, 'USD')}
            </p>
            <p className="text-xs text-ink-muted">
              {t('pay', 'processingFee')} {formatMoney(economics.processingFee, 'USD')}
            </p>
          </div>
          <div className="rounded-lg border border-line p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t('direct', 'economicsOnMarketplace')}
            </p>
            <p className="mt-1 text-xl font-bold text-ink-soft">
              {formatMoney(economics.marketplaceEquivalent, 'USD')}
            </p>
          </div>
        </div>

        <p className="mt-2 text-sm font-bold text-success">
          {t('direct', 'economicsSaved', { amount: formatMoney(economics.saved, 'USD') })}
        </p>
      </section>

      {/* ---------------------------------------------------- toggle */}
      <section className="rounded-card border border-line bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink">{t('direct', 'title', { brand: brand.name })}</h2>
            <p className="text-xs text-ink-muted">{t('direct', 'subtitle')}</p>
          </div>
          {enabled ? <Badge tone="success">{t('direct', 'enabled')}</Badge> : null}
        </div>

        {!hasPayoutMethod ? (
          <p className="mt-3 rounded-lg bg-warning/10 p-3 text-xs font-semibold text-ink-soft">
            {t('direct', 'needsPayout')}
          </p>
        ) : null}

        {enabled ? (
          <>
            <Field label={t('direct', 'feeBearer')} className="mt-3">
              {() => (
                <div className="space-y-1">
                  <Radio
                    name="fee-bearer"
                    label={t('direct', 'feeBearerOperator')}
                    checked={feeBearer === 'operator'}
                    onChange={() => {
                      setFeeBearer('operator');
                      void call({ action: 'enable', acceptTerms: true, feeBearer: 'operator' });
                    }}
                  />
                  <Radio
                    name="fee-bearer"
                    label={t('direct', 'feeBearerCustomer')}
                    checked={feeBearer === 'customer'}
                    onChange={() => {
                      setFeeBearer('customer');
                      void call({ action: 'enable', acceptTerms: true, feeBearer: 'customer' });
                    }}
                  />
                </div>
              )}
            </Field>

            <Button
              variant="secondary"
              className="mt-3"
              disabled={busy}
              onClick={() =>
                call({ action: 'disable' }, () =>
                  setSettings(settings ? { ...settings, enabled: false } : null),
                )
              }
            >
              {t('direct', 'disable')}
            </Button>
          </>
        ) : (
          <Button
            className="mt-3"
            disabled={!hasPayoutMethod}
            onClick={() => setShowTerms(true)}
          >
            {t('direct', 'enable')}
          </Button>
        )}

        {error ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
        {notice ? <p className="mt-2 text-sm font-semibold text-success">{notice}</p> : null}
      </section>

      {/* ---------------------------------------------------- invites */}
      {enabled ? (
        <section className="rounded-card border border-line bg-white p-4">
          <h2 className="text-sm font-bold text-ink">{t('direct', 'inviteTitle')}</h2>
          <p className="text-xs text-ink-muted">{t('direct', 'inviteBody')}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {(
              [
                { key: 'qr' as const, label: t('direct', 'inviteQr'), body: t('direct', 'inviteQrBody'), icon: 'grid' },
                { key: 'email' as const, label: t('direct', 'inviteEmail'), body: t('direct', 'inviteEmailBody'), icon: 'mail' },
                { key: 'sms' as const, label: t('direct', 'inviteSms'), body: t('direct', 'inviteSmsBody'), icon: 'phone' },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setInviteChannel(option.key)}
                aria-pressed={inviteChannel === option.key}
                className={cx(
                  'rounded-lg border p-3 text-left transition-colors',
                  inviteChannel === option.key
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-line hover:bg-surface-sunken',
                )}
              >
                <Icon name={option.icon} size={16} className="text-brand-700" />
                <span className="mt-1 block text-sm font-bold text-ink">{option.label}</span>
                <span className="block text-xs text-ink-muted">{option.body}</span>
              </button>
            ))}
          </div>

          {listings.length > 1 ? (
            <Field label={t('direct', 'selectListing')} className="mt-3">
              {({ id }) => (
                <Select id={id} value={inviteListing} onChange={(e) => setInviteListing(e.target.value)}>
                  {listings.map((listing) => (
                    <option key={listing.id} value={listing.id}>
                      {listing.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}

          {inviteChannel !== 'qr' ? (
            <Field
              label={inviteChannel === 'email' ? t('login', 'email') : t('login', 'phone')}
              className="mt-3"
            >
              {({ id }) => (
                <Input
                  id={id}
                  type={inviteChannel === 'email' ? 'email' : 'tel'}
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={t('direct', inviteChannel === 'email' ? 'emailPlaceholder' : 'phonePlaceholder')}
                />
              )}
            </Field>
          ) : null}

          <Button
            className="mt-3"
            disabled={busy || (inviteChannel !== 'qr' && !recipient.trim())}
            onClick={() =>
              call(
                {
                  action: 'invite',
                  charterId: inviteListing,
                  channel: inviteChannel,
                  recipient: inviteChannel === 'qr' ? undefined : recipient,
                },
                (result) => {
                  const invite = result as { token: string };
                  setInviteToken(invite.token);
                  if (inviteChannel !== 'qr') setNotice(t('direct', 'inviteSent'));
                },
              )
            }
          >
            {inviteChannel === 'qr' ? t('direct', 'inviteQr') : t('offers', 'sendOffer')}
          </Button>

          {inviteUrl ? (
            <div className="mt-4 rounded-lg border border-line p-3 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                {t('direct', 'inviteLink')}
              </p>
              <QrCode value={inviteUrl} className="mx-auto mt-2" />
              <p className="mt-2 break-all text-xs text-ink-soft">{inviteUrl}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* --------------------------------------------- manual booking */}
      <section className="rounded-card border border-line bg-white p-4">
        <h2 className="text-sm font-bold text-ink">{t('direct', 'manualTitle')}</h2>
        <p className="text-xs text-ink-muted">{t('direct', 'manualBody')}</p>
        <Button variant="secondary" className="mt-3" onClick={() => setShowManual(true)}>
          <Icon name="plus" size={15} />
          {t('direct', 'manualTitle')}
        </Button>
      </section>

      {/* ------------------------------------------------------ modals */}
      <Overlay open={showTerms} onClose={() => setShowTerms(false)} title={t('direct', 'termsTitle')}>
        <ul className="space-y-2">
          {[1, 2, 3].map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm text-ink-soft">
              <Icon name="check" size={15} className="mt-0.5 shrink-0 text-success" />
              {t('direct', `termsPoint${point}`)}
            </li>
          ))}
        </ul>

        <Checkbox
          label={t('direct', 'acceptTerms')}
          className="mt-4"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
        />

        <Button
          className="mt-4 w-full"
          disabled={!acceptTerms || busy}
          onClick={() =>
            call({ action: 'enable', acceptTerms: true, feeBearer }, (result) => {
              setSettings(result as DirectSettings);
              setShowTerms(false);
            })
          }
        >
          {t('direct', 'enable')}
        </Button>
      </Overlay>

      <ManualBookingSheet
        open={showManual}
        onClose={() => setShowManual(false)}
        listings={listings}
        onSubmit={(payload) =>
          call(payload, () => {
            setShowManual(false);
            setNotice(t('direct', 'manualAdded'));
          })
        }
        busy={busy}
      />
    </div>
  );
}

function ManualBookingSheet({
  open,
  onClose,
  listings,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  listings: DirectListing[];
  onSubmit: (payload: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [charterId, setCharterId] = useState(listings[0]?.id ?? '');
  const listing = listings.find((l) => l.id === charterId);
  const [packageId, setPackageId] = useState(listing?.packages[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [departureTime, setDepartureTime] = useState('08:00');
  const [adults, setAdults] = useState(2);
  const [price, setPrice] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');

  return (
    <Overlay open={open} onClose={onClose} title={t('direct', 'manualTitle')}>
      <div className="space-y-3">
        {listings.length > 1 ? (
          <Field label={t('direct', 'selectListing')}>
            {({ id }) => (
              <Select
                id={id}
                value={charterId}
                onChange={(e) => {
                  setCharterId(e.target.value);
                  const next = listings.find((l) => l.id === e.target.value);
                  setPackageId(next?.packages[0]?.id ?? '');
                }}
              >
                {listings.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}

        <Field label={t('offers', 'tripPackage')}>
          {({ id }) => (
            <Select id={id} value={packageId} onChange={(e) => setPackageId(e.target.value)}>
              {(listing?.packages ?? []).map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.title}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('booking', 'tripDate')}>
            {({ id }) => (
              <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            )}
          </Field>
          <Field label={t('booking', 'tripTime')}>
            {({ id }) => (
              <Input
                id={id}
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('pickers', 'adults')}>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={1}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value) || 1)}
              />
            )}
          </Field>
          <Field label={t('direct', 'manualAgreedPrice')}>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('login', 'firstName')}>
            {({ id }) => (
              <Input id={id} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            )}
          </Field>
          <Field label={t('login', 'lastName')}>
            {({ id }) => (
              <Input id={id} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            )}
          </Field>
        </div>

        <Field label={t('login', 'email')}>
          {({ id }) => (
            <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field label={t('login', 'phone')}>
          {({ id }) => (
            <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          )}
        </Field>

        <Field label={t('direct', 'manualNote')}>
          {({ id }) => (
            <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          )}
        </Field>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t('general', 'cancel')}
          </Button>
          <Button
            className="flex-1"
            disabled={busy || !date || !packageId || !firstName.trim()}
            onClick={() =>
              onSubmit({
                action: 'manual_booking',
                charterId,
                manual: {
                  packageId,
                  date,
                  departureTime,
                  adults,
                  children: 0,
                  agreedPrice: Number(price) || 0,
                  contact: { firstName, lastName, email, phone },
                  note,
                },
              })
            }
          >
            {t('general', 'save')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
