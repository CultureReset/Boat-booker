'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { currencies, languages } from '@/config/locale';
import { translate as t } from '@/i18n/translate';
import { api, errorMessage } from '@/lib/client/api';
import { useSession } from '@/components/providers/SessionProvider';
import { useToast } from '@/components/providers/ToastProvider';
import type { PublicUser } from '@/lib/auth/session';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';

/**
 * Profile editor.
 *
 * Fields are staged locally and saved in one request, so a half-finished edit
 * never lands on the server. The session is refreshed after a save so the
 * header and any other consumer pick up the new name immediately.
 */
export function ProfileForm({ user }: { user: PublicUser }) {
  const router = useRouter();
  const { refresh } = useSession();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [language, setLanguage] = useState(user.language);
  const [currency, setCurrency] = useState(user.currency);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch('/api/me', { firstName, lastName, phone, bio, language, currency });
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
        <h2 className="mb-1 text-base font-bold text-ink">{t('account', 'personalInfo')}</h2>
        <p className="mb-4 text-sm text-ink-muted">{t('account', 'profileBody')}</p>

        <div className="mb-4 flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-800">
            {(firstName[0] ?? '?').toUpperCase()}
            {(lastName[0] ?? '').toUpperCase()}
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">
              {firstName} {lastName}
            </p>
            <p className="text-xs text-ink-muted">{user.email}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('login', 'firstName')} required>
            {({ id }) => (
              <Input id={id} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
            )}
          </Field>
          <Field label={t('login', 'lastName')} required>
            {({ id }) => (
              <Input id={id} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
            )}
          </Field>
          <Field label={t('login', 'phone')} className="sm:col-span-2">
            {({ id }) => (
              <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            )}
          </Field>
          <Field label={t('account', 'aboutYou')} className="sm:col-span-2">
            {({ id }) => (
              <Textarea
                id={id}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder={t('account', 'aboutYouPlaceholder')}
                maxLength={1000}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="rounded-card border border-line bg-white p-4">
        <h2 className="mb-4 text-base font-bold text-ink">{t('account', 'languageAndCurrency')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('navigation', 'changeLanguage')}>
            {({ id }) => (
              <Select id={id} value={language} onChange={(e) => setLanguage(e.target.value)}>
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('navigation', 'changeCurrency')}>
            {({ id }) => (
              <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name} ({item.symbol})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </section>

      <Button type="submit" size="lg" loading={busy}>
        {t('general', 'saveChanges')}
      </Button>
    </form>
  );
}
