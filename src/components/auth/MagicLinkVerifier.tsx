'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { api, errorMessage } from '@/lib/client/api';
import { useSession } from '@/components/providers/SessionProvider';
import { Icon } from '@/components/ui/Icon';
import { Button, Spinner } from '@/components/ui/primitives';
import type { PublicUser } from '@/lib/auth/session';

/**
 * Consumes a magic-link token and signs the user in.
 *
 * Tokens are single-use, so the exchange is guarded against React's
 * development double-effect — firing twice would burn the token and show the
 * user a spurious "link expired".
 */
export function MagicLinkVerifier() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, refresh } = useSession();

  const [error, setError] = useState<string | null>(null);
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setError(t('login', 'errorGeneric'));
      return;
    }

    api
      .get<{ user: PublicUser; needsProfile: boolean }>(
        `/api/auth/magic-link?token=${encodeURIComponent(token)}`,
      )
      .then(async (result) => {
        setUser(result.user);
        await refresh();
        // A brand-new account created by the link still needs a name before it
        // can book, so send it to the profile screen first.
        router.push(
          result.needsProfile ? '/account/profile' : result.user.role === 'owner' ? '/owner' : '/',
        );
        router.refresh();
      })
      .catch((caught) => setError(errorMessage(caught)));
  }, [searchParams, router, setUser, refresh]);

  if (error) {
    return (
      <div className="w-full max-w-sm rounded-card border border-line bg-white p-6 text-center shadow-card">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-danger">
          <Icon name="alert" size={24} />
        </span>
        <h1 className="mt-3 text-base font-bold text-ink">{t('login', 'errorGeneric')}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{error}</p>
        <Button className="mt-4" fullWidth onClick={() => router.push('/login')}>
          {t('login', 'backToSignIn')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Spinner size={28} className="text-brand-600" />
      <p className="text-sm font-medium text-ink-soft">{t('login', 'processing')}</p>
    </div>
  );
}
