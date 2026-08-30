'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { passwordRules } from '@/lib/auth/password';
import { api, errorMessage } from '@/lib/client/api';
import { useSession } from '@/components/providers/SessionProvider';
import { Icon } from '@/components/ui/Icon';
import { Button, Field, Input, RichText } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import type { PublicUser } from '@/lib/auth/session';

/**
 * Authentication form.
 *
 * One component drives every step of the flow — email, password, signup,
 * magic link, forgot password — because they share state (the address typed,
 * the account type chosen) and hopping between them should never lose it.
 *
 * The step machine:
 *
 *   choose-account ─▶ email ─┬─▶ password ────▶ done
 *                            ├─▶ signup ──────▶ done
 *                            └─▶ magic-sent
 *   password ─▶ forgot ─▶ forgot-sent
 */

export type AuthStep =
  | 'choose-account'
  | 'email'
  | 'password'
  | 'signup'
  | 'magic-sent'
  | 'forgot'
  | 'forgot-sent';

export type AccountType = 'customer' | 'owner';

export interface AuthFormProps {
  /** Where to begin. The owner entry point starts on the account chooser. */
  initialStep?: AuthStep;
  initialAccountType?: AccountType;
  /** Called after a successful sign-in or signup. */
  onSuccess?: (user: PublicUser) => void;
  /** Path to send the user to on success, when no handler is supplied. */
  redirectTo?: string;
  compact?: boolean;
}

export function AuthForm({
  initialStep = 'email',
  initialAccountType = 'customer',
  onSuccess,
  redirectTo,
  compact,
}: AuthFormProps) {
  const router = useRouter();
  const { setUser, refresh } = useSession();

  const [step, setStep] = useState<AuthStep>(initialStep);
  const [accountType, setAccountType] = useState<AccountType>(initialAccountType);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkUrl, setMagicLinkUrl] = useState<string | null>(null);

  const ruleState = useMemo(
    () => passwordRules.map((rule) => ({ key: rule.key, met: rule.test(password) })),
    [password],
  );
  const passwordValid = ruleState.every((rule) => rule.met);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const succeed = async (user: PublicUser) => {
    setUser(user);
    await refresh();
    if (onSuccess) onSuccess(user);
    else if (redirectTo) router.push(redirectTo);
    else router.refresh();
  };

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!emailValid) {
      setError(t('login', 'errorInvalidEmail'));
      return;
    }
    // The password step is offered first; the magic-link button below is the
    // alternative. Which one an address supports is not revealed here, since
    // that would leak whether the account exists.
    setStep('password');
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await api.post<{ user: PublicUser }>('/api/auth/login', { email, password });
      await succeed(result.user);
    } catch (caught) {
      setError(errorMessage(caught, t('login', 'errorGeneric')));
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!firstName.trim()) return setError(t('login', 'errorFirstNameRequired'));
    if (!lastName.trim()) return setError(t('login', 'errorLastNameRequired'));
    if (!passwordValid) return setError(t('login', 'passwordMinLength'));
    if (accountType === 'owner' && !companyName.trim()) {
      return setError(t('login', 'companyName'));
    }

    setBusy(true);
    try {
      const result = await api.post<{ user: PublicUser }>('/api/auth/signup', {
        email,
        password,
        firstName,
        lastName,
        phone,
        companyName,
        accountType,
      });
      await succeed(result.user);
    } catch (caught) {
      setError(errorMessage(caught, t('login', 'errorGeneric')));
    } finally {
      setBusy(false);
    }
  };

  const sendMagicLink = async () => {
    setError(null);
    if (!emailValid) {
      setError(t('login', 'errorInvalidEmail'));
      return;
    }
    setBusy(true);
    try {
      const result = await api.post<{ loginUrl?: string }>('/api/auth/magic-link', {
        email,
        intent: accountType,
      });
      setMagicLinkUrl(result.loginUrl ?? null);
      setStep('magic-sent');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await api.post<{ resetUrl?: string }>('/api/auth/reset-password', { email });
      setMagicLinkUrl(result.resetUrl ?? null);
      setStep('forgot-sent');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const errorBanner = error ? (
    <p role="alert" className="flex items-start gap-2 rounded-control bg-red-50 px-3 py-2.5 text-sm text-red-800">
      <Icon name="alert" size={16} className="mt-0.5" />
      {error}
    </p>
  ) : null;

  // ---------------------------------------------------------------- steps

  if (step === 'choose-account') {
    return (
      <div className="flex flex-col gap-3">
        <h2 className={cx('font-bold text-ink', compact ? 'text-lg' : 'text-xl')}>
          {t('login', 'accountTypeTitle')}
        </h2>
        {(
          [
            { type: 'customer' as const, icon: 'search' as const, title: t('login', 'accountTypeCustomer'), body: t('login', 'accountTypeCustomerBody') },
            { type: 'owner' as const, icon: 'boat' as const, title: t('login', 'accountTypeOwner'), body: t('login', 'accountTypeOwnerBody') },
          ]
        ).map((option) => (
          <button
            key={option.type}
            type="button"
            onClick={() => {
              setAccountType(option.type);
              setStep('email');
            }}
            className="flex items-start gap-3 rounded-card border border-line p-4 text-left transition-colors hover:border-brand-500 hover:bg-brand-50/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Icon name={option.icon} size={20} />
            </span>
            <span>
              <span className="block text-sm font-bold text-ink">{option.title}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{option.body}</span>
            </span>
            <Icon name="chevron-right" size={18} className="ml-auto mt-2.5 text-ink-faint" />
          </button>
        ))}
      </div>
    );
  }

  if (step === 'magic-sent' || step === 'forgot-sent') {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Icon name="mail" size={26} />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">{t('login', 'checkYourInbox')}</h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            <RichText
              html={
                step === 'magic-sent'
                  ? t('login', 'checkYourInboxDescription', { email })
                  : t('login', 'forgotPasswordSent', { email })
              }
            />
          </p>
        </div>

        {/*
          There is no mail transport in this build, so the link the email would
          have contained is surfaced here instead. A deployment with SMTP
          configured sets AUTH_EXPOSE_MAGIC_LINK=false and this disappears.
        */}
        {magicLinkUrl ? (
          <div className="w-full rounded-control border border-dashed border-brand-300 bg-brand-50/60 p-3">
            <p className="mb-2 text-xs font-semibold text-brand-900">{t('login', 'magicLinkDevNotice')}</p>
            <Button
              type="button"
              size="sm"
              fullWidth
              onClick={() => router.push(magicLinkUrl)}
              iconRight="arrow-right"
            >
              {t('login', 'openLink')}
            </Button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setStep('email')}
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          {t('login', 'backToSignIn')}
        </button>
      </div>
    );
  }

  if (step === 'forgot') {
    return (
      <form onSubmit={sendReset} className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">{t('login', 'forgotPasswordTitle')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('login', 'forgotPasswordInstruction')}</p>
        </div>
        {errorBanner}
        <Field label={t('login', 'email')} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          )}
        </Field>
        <Button type="submit" fullWidth size="lg" loading={busy}>
          {t('general', 'continue')}
        </Button>
        <button
          type="button"
          onClick={() => setStep('password')}
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          {t('login', 'backToSignIn')}
        </button>
      </form>
    );
  }

  if (step === 'signup') {
    return (
      <form onSubmit={submitSignup} className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">
            {accountType === 'owner' ? t('login', 'listYourBusiness') : t('login', 'createAccount')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{email}</p>
        </div>
        {errorBanner}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('login', 'firstName')} required>
            {({ id }) => (
              <Input
                id={id}
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            )}
          </Field>
          <Field label={t('login', 'lastName')} required>
            {({ id }) => (
              <Input
                id={id}
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            )}
          </Field>
        </div>

        {accountType === 'owner' ? (
          <Field label={t('login', 'companyName')} required>
            {({ id }) => (
              <Input
                id={id}
                autoComplete="organization"
                placeholder={t('login', 'companyNamePlaceholder')}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            )}
          </Field>
        ) : null}

        <Field label={t('login', 'phone')} hint={t('general', 'optional')}>
          {({ id }) => (
            <Input
              id={id}
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          )}
        </Field>

        <Field label={t('login', 'password')} required>
          {({ id }) => (
            <div className="relative">
              <Input
                id={id}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('login', 'hidePassword') : t('login', 'showPassword')}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-ink-muted hover:text-ink"
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
              </button>
            </div>
          )}
        </Field>

        {/* Live checklist so the requirement is visible before submitting. */}
        <ul className="-mt-1 grid gap-1 sm:grid-cols-2">
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

        <Button type="submit" fullWidth size="lg" loading={busy} disabled={!passwordValid}>
          {busy ? t('login', 'creatingAccount') : t('login', 'signup')}
        </Button>

        <p className="text-center text-xs text-ink-muted">
          <RichText html={t('login', 'termsAgreement')} className="[&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline" />
        </p>

        <button
          type="button"
          onClick={() => setStep('password')}
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          {t('login', 'alreadyAMember')} {t('login', 'login')}
        </button>
      </form>
    );
  }

  if (step === 'password') {
    return (
      <form onSubmit={submitPassword} className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">{t('login', 'logInToAccount')}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
            {email}
            <button
              type="button"
              onClick={() => setStep('email')}
              className="font-semibold text-brand-700 hover:underline"
            >
              {t('general', 'edit')}
            </button>
          </p>
        </div>
        {errorBanner}

        <Field label={t('login', 'password')} required>
          {({ id }) => (
            <div className="relative">
              <Input
                id={id}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('login', 'hidePassword') : t('login', 'showPassword')}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-ink-muted hover:text-ink"
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
              </button>
            </div>
          )}
        </Field>

        <Button type="submit" fullWidth size="lg" loading={busy}>
          {t('login', 'login')}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setStep('forgot')}
            className="font-semibold text-brand-700 hover:underline"
          >
            {t('login', 'forgotPassword')}
          </button>
          <button
            type="button"
            onClick={() => setStep('signup')}
            className="font-semibold text-brand-700 hover:underline"
          >
            {t('login', 'createAccount')}
          </button>
        </div>

        <Divider label={t('login', 'or')} />

        <Button type="button" variant="outline" fullWidth size="lg" icon="mail" onClick={sendMagicLink} loading={busy}>
          {t('login', 'loginWithMagicLink')}
        </Button>
      </form>
    );
  }

  // step === 'email'
  return (
    <form onSubmit={submitEmail} className="flex flex-col gap-4">
      <div>
        <h2 className={cx('font-bold text-ink', compact ? 'text-lg' : 'text-xl')}>
          {accountType === 'owner' ? t('login', 'ownerPortalTitle') : t('login', 'welcomeTitle')}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{t('login', 'welcomeSubtitle')}</p>
      </div>
      {errorBanner}

      <Field label={t('login', 'email')} required>
        {({ id }) => (
          <Input
            id={id}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            required
          />
        )}
      </Field>

      <Button type="submit" fullWidth size="lg" disabled={!emailValid}>
        {t('login', 'continueWithEmail')}
      </Button>

      <Divider label={t('login', 'or')} />

      <Button type="button" variant="outline" fullWidth size="lg" icon="mail" onClick={sendMagicLink} loading={busy}>
        {t('login', 'loginWithMagicLink')}
      </Button>

      {accountType === 'customer' ? (
        <button
          type="button"
          onClick={() => {
            setAccountType('owner');
            setStep('signup');
          }}
          className="text-center text-sm font-semibold text-brand-700 hover:underline"
        >
          {t('login', 'listYourBusiness')}
        </button>
      ) : null}

      {/*
        Seeded credentials, shown so every flow in the build can be exercised
        without hunting through the fixtures.
      */}
      <div className="rounded-control border border-line bg-surface-sunken p-3">
        <p className="mb-1.5 text-xs font-bold text-ink">{t('login', 'demoAccountsTitle')}</p>
        <p className="mb-2 text-xs text-ink-muted">{t('login', 'demoAccountsBody')}</p>
        <div className="grid gap-1.5">
          <DemoAccount
            label={t('login', 'accountTypeCustomer')}
            email="guest@boatbooker.demo"
            onUse={(value) => {
              setEmail(value);
              setPassword('Password123');
              setStep('password');
            }}
          />
          <DemoAccount
            label={t('login', 'accountTypeOwner')}
            email="owner@boatbooker.demo"
            onUse={(value) => {
              setEmail(value);
              setPassword('Password123');
              setStep('password');
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-ink-faint">
          {brand.name} demo · password <code className="font-mono">Password123</code>
        </p>
      </div>
    </form>
  );
}

function DemoAccount({
  label,
  email,
  onUse,
}: {
  label: string;
  email: string;
  onUse: (email: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onUse(email)}
      className="flex items-center justify-between gap-2 rounded border border-line bg-white px-2.5 py-2 text-left text-xs transition-colors hover:border-brand-400"
    >
      <span>
        <span className="block font-semibold text-ink">{label}</span>
        <span className="block font-mono text-[11px] text-ink-muted">{email}</span>
      </span>
      <Icon name="arrow-right" size={14} className="text-ink-faint" />
    </button>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
