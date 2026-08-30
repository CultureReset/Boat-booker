'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { passwordRules } from '@/lib/auth/password';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Button, Field, Input } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Sets a new password from a reset token.
 *
 * The same live rule checklist as signup, so the requirements are visible
 * before the form is submitted rather than announced as an error afterwards.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ruleState = useMemo(
    () => passwordRules.map((rule) => ({ key: rule.key, met: rule.test(password) })),
    [password],
  );
  const valid = ruleState.every((rule) => rule.met) && password === confirm;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(t('login', 'passwordsDontMatch'));
      return;
    }

    setBusy(true);
    try {
      await api.put('/api/auth/reset-password', { token, password });
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-success">
          <Icon name="check-circle" size={24} />
        </span>
        <h1 className="mt-3 text-base font-bold text-ink">{t('account', 'savedSuccess')}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{t('login', 'signedOut')}</p>
        <Button className="mt-4" fullWidth onClick={() => router.push('/login')}>
          {t('login', 'goToSignIn')}
        </Button>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-base font-bold text-ink">{t('login', 'errorGeneric')}</h1>
        <Button className="mt-4" fullWidth onClick={() => router.push('/login')}>
          {t('login', 'backToSignIn')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-ink">{t('login', 'choosePassword')}</h1>

      {error ? (
        <p role="alert" className="rounded-control bg-red-50 px-3 py-2.5 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <Field label={t('login', 'newPassword')} required>
        {({ id }) => (
          <div className="relative">
            <Input
              id={id}
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
              autoFocus
              required
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? t('login', 'hidePassword') : t('login', 'showPassword')}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-ink-muted hover:text-ink"
            >
              <Icon name={show ? 'eye-off' : 'eye'} size={18} />
            </button>
          </div>
        )}
      </Field>

      <Field
        label={t('login', 'confirmNewPassword')}
        required
        error={confirm && password !== confirm ? t('login', 'passwordsDontMatch') : undefined}
      >
        {({ id, invalid }) => (
          <Input
            id={id}
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            invalid={invalid}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        )}
      </Field>

      <ul className="grid gap-1">
        {ruleState.map((rule) => (
          <li
            key={rule.key}
            className={cx('flex items-center gap-1.5 text-xs', rule.met ? 'text-success' : 'text-ink-muted')}
          >
            <Icon name={rule.met ? 'check-circle' : 'info'} size={13} />
            {t('login', rule.key)}
          </li>
        ))}
      </ul>

      <Button type="submit" size="lg" fullWidth loading={busy} disabled={!valid}>
        {t('login', 'createMyPasswordCTA')}
      </Button>
    </form>
  );
}
