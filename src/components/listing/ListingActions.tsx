'use client';

import { useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { api } from '@/lib/client/api';
import { useSession } from '@/components/providers/SessionProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { Icon } from '@/components/ui/Icon';
import { AuthModal } from '@/components/auth/AuthModal';

/**
 * Save and share controls for the listing header.
 *
 * Kept apart from the page so the route itself stays a server component; these
 * are the only two things in the header that need client state.
 */

export function SaveButton({ charterId, initialSaved }: { charterId: string; initialSaved: boolean }) {
  const { user } = useSession();
  const { toast } = useToast();

  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const save = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }

    const next = !saved;
    setSaved(next);
    setPending(true);
    try {
      const result = await api.post<{ saved: boolean }>('/api/wishlist', { charterId });
      setSaved(result.saved);
      toast(
        result.saved ? t('viewCharter', 'savedToWishlist') : t('viewCharter', 'removedFromWishlist'),
        'success',
      );
    } catch {
      setSaved(!next);
      toast(t('general', 'error'), 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? t('listingCard', 'removeFromWishlist') : t('listingCard', 'addToWishlist')}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-surface-sunken"
      >
        <Icon
          name={saved ? 'heart-filled' : 'heart'}
          size={18}
          className={saved ? 'text-danger' : 'text-ink-soft'}
        />
      </button>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          void api.post('/api/wishlist', { charterId }).then(() => setSaved(true));
        }}
      />
    </>
  );
}

export function ShareButton({ title }: { title: string }) {
  const { toast } = useToast();

  const share = async () => {
    const url = window.location.href;

    // Use the OS share sheet where it exists — that is what a phone user
    // expects — and fall back to copying the link everywhere else.
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Cancelled, or the browser refused; fall through to the clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast(t('general', 'copied'), 'success');
    } catch {
      toast(t('general', 'error'), 'error');
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label={t('viewCharter', 'shareTitle')}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:bg-surface-sunken"
    >
      <Icon name="share" size={18} />
    </button>
  );
}
