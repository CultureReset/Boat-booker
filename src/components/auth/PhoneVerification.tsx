'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { api, errorMessage } from '@/lib/client/api';
import { CODE_LENGTH } from '@/lib/services/verification';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

/**
 * Phone verification: enter a number, answer the code.
 *
 * Two steps in one component because they are one task — the number is only
 * asked for so the code can be sent, and going "back" means correcting a typo
 * in it, which is a state change rather than a screen.
 *
 * The resend timer counts down from what the *server* reported, not from a
 * local constant: a reload mid-cooldown resumes where it was rather than
 * offering a resend the server will refuse.
 */

interface Status {
  phone: string | null;
  verified: boolean;
  resendAfterSeconds: number;
}

export function PhoneVerification({
  initial,
  next,
}: {
  initial: Status;
  /** Where to go once the number is verified. */
  next: string;
}) {
  const router = useRouter();

  const [phone, setPhone] = useState(initial.phone ?? '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(initial.resendAfterSeconds > 0);
  const [remaining, setRemaining] = useState(initial.resendAfterSeconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const codeRef = useRef<HTMLInputElement>(null);

  // One interval for the whole countdown, cleared when it reaches zero so an
  // idle screen is not re-rendering once a second forever.
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const send = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.post<{ resendAfterSeconds: number; code?: string; phone: string }>(
        '/api/auth/phone',
        { action: 'send', phone },
      );
      setSent(true);
      setRemaining(result.resendAfterSeconds);
      // Demo builds return the code because there is no SMS transport; a real
      // deployment returns nothing here and the field stays empty.
      if (result.code) {
        setCode(result.code);
        setNotice(t('login', 'phoneCodeDevNotice', { code: result.code }));
      }
      codeRef.current?.focus();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }, [phone]);

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/phone', { action: 'verify', code });
      router.push(next);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  if (initial.verified) {
    return (
      <div className="flex items-start gap-3 rounded-card border border-line bg-white p-4">
        <Icon name="check-circle" size={20} className="mt-0.5 shrink-0 text-success" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">{t('login', 'phoneVerifiedTitle')}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{initial.phone}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label={t('login', 'phoneLabel')} hint={t('login', 'phoneHint')} required>
        {({ id }) => (
          <Input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+1 555 0100"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            // While a code is outstanding the number is what it was sent to;
            // editing it without resending would verify against the wrong one.
            disabled={sent}
            maxLength={24}
          />
        )}
      </Field>

      {!sent ? (
        <Button fullWidth loading={busy} disabled={phone.trim().length < 7} onClick={send}>
          {t('login', 'sendCode')}
        </Button>
      ) : (
        <>
          <Field label={t('login', 'codeLabel')} hint={t('login', 'codeHint', { phone })} required>
            {({ id }) => (
              <Input
                id={id}
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="text-center text-lg font-bold tracking-[0.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                maxLength={CODE_LENGTH}
              />
            )}
          </Field>

          {notice ? (
            <p className="rounded-control border border-dashed border-brand-300 bg-brand-50/60 px-3 py-2 text-xs text-brand-900">
              {notice}
            </p>
          ) : null}

          <Button fullWidth loading={busy} disabled={code.length < CODE_LENGTH} onClick={verify}>
            {t('login', 'verifyCode')}
          </Button>

          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setCode('');
                setNotice(null);
                setError(null);
              }}
              className="font-semibold text-brand-700 hover:underline"
            >
              {t('login', 'changeNumber')}
            </button>

            {/* Disabled with the seconds shown, rather than hidden: a countdown
                answers "why can't I resend" without the person having to ask. */}
            <button
              type="button"
              onClick={send}
              disabled={remaining > 0 || busy}
              className="font-semibold text-brand-700 hover:underline disabled:text-ink-muted disabled:no-underline"
            >
              {remaining > 0 ? t('login', 'resendIn', { seconds: remaining }) : t('login', 'resendCode')}
            </button>
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
