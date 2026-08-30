'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { currencies } from '@/config/locale';
import { translate as t } from '@/i18n/translate';
import { api, errorMessage } from '@/lib/client/api';
import { useSession } from '@/components/providers/SessionProvider';
import { useToast } from '@/components/providers/ToastProvider';
import type { PublicUser } from '@/lib/auth/session';
import { Button, Field, Input, Select, Textarea, Toggle } from '@/components/ui/primitives';

/**
 * Business settings.
 *
 * Company-level fields only. Per-listing policy (deposit, cancellation window,
 * instant book) lives in the listing editor so an operator can run different
 * rules on different boats.
 */
export function OwnerSettings({ user }: { user: PublicUser }) {
  const router = useRouter();
  const { refresh } = useSession();
  const { toast } = useToast();

  const profile = user.ownerProfile;

  const [companyName, setCompanyName] = useState(profile?.companyName ?? '');
  const [captainName, setCaptainName] = useState(profile?.captainName ?? '');
  const [background, setBackground] = useState(profile?.background ?? '');
  const [experience, setExperience] = useState(profile?.experience ?? '');
  const [languages, setLanguages] = useState(profile?.languages ?? 'English');
  const [yearStarted, setYearStarted] = useState(
    String(profile?.yearStartedRunningCharters ?? new Date().getFullYear()),
  );
  const [onlinePayments, setOnlinePayments] = useState(profile?.onlinePaymentsEnabled ?? false);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [currency, setCurrency] = useState(user.currency);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch('/api/owner/settings', {
        companyName,
        captainName,
        background,
        experience,
        languages,
        yearStartedRunningCharters: Number(yearStarted),
        onlinePaymentsEnabled: onlinePayments,
        phone,
        currency,
      });
      await refresh();
      toast(t('account', 'savedSuccess'), 'success');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="max-w-xl space-y-6">
      {error ? (
        <p role="alert" className="rounded-control bg-red-50 px-3 py-2.5 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-card border border-line bg-white p-4">
        <h2 className="mb-4 text-base font-bold text-ink">{t('owner', 'settingsTitle')}</h2>

        <div className="grid gap-4">
          <Field label={t('owner', 'businessName')} required>
            {({ id }) => (
              <Input
                id={id}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="organization"
              />
            )}
          </Field>

          <Field label={t('search', 'captain')}>
            {({ id }) => (
              <Input id={id} value={captainName} onChange={(e) => setCaptainName(e.target.value)} />
            )}
          </Field>

          <Field label={t('owner', 'businessPhone')}>
            {({ id }) => (
              <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            )}
          </Field>

          <Field label={t('viewCharter', 'captainLanguages', { languages: '' }).replace(/\s+$/, '')}>
            {({ id }) => (
              <Input
                id={id}
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                placeholder="English, Spanish"
              />
            )}
          </Field>

          <Field label={t('viewCharter', 'captainSince', { year: '' }).replace(/\s+$/, '')}>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={yearStarted}
                onChange={(e) => setYearStarted(e.target.value)}
              />
            )}
          </Field>

          <Field label={t('viewCharter', 'captainBackground')} hint="Shown on every one of your listings.">
            {({ id }) => (
              <Textarea id={id} value={background} onChange={(e) => setBackground(e.target.value)} rows={5} />
            )}
          </Field>

          <Field label={t('viewCharter', 'captainExperience')}>
            {({ id }) => (
              <Input id={id} value={experience} onChange={(e) => setExperience(e.target.value)} />
            )}
          </Field>

          <Field label={t('owner', 'defaultCurrency')}>
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
        </div>
      </section>

      <section className="rounded-card border border-line bg-white p-4">
        <h2 className="mb-1 text-base font-bold text-ink">{t('owner', 'onlinePaymentsTitle')}</h2>
        <Toggle
          label={t('owner', 'enableOnlinePayments')}
          description={t('owner', 'onlinePaymentsBody')}
          checked={onlinePayments}
          onChange={setOnlinePayments}
        />
      </section>

      <Button type="submit" size="lg" loading={busy}>
        {t('general', 'saveChanges')}
      </Button>
    </form>
  );
}
