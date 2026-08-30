'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Button, Field, Textarea } from '@/components/ui/primitives';
import type { BuddyInvitation } from '@/lib/domain/types';

/**
 * Invite the people coming along.
 *
 * A single textarea rather than a repeating email field: people paste a list
 * from a group chat, and making them add rows one at a time is the fastest way
 * to have them not bother.
 */
export function BuddyInvites({
  bookingId,
  invitations: initial,
}: {
  bookingId: string;
  invitations: BuddyInvitation[];
}) {
  const router = useRouter();
  const [invitations, setInvitations] = useState(initial);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const emails = raw
      .split(/[,\n;]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (!emails.length) return;

    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ invitations: BuddyInvitation[] }>('/api/social', {
        action: 'invite_buddies',
        bookingId,
        emails,
      });
      setInvitations(result.invitations);
      setRaw('');
      setSent(true);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-card border border-line bg-white p-4">
      <h2 className="text-sm font-bold text-ink">{t('buddies', 'title')}</h2>
      <p className="text-xs text-ink-muted">{t('buddies', 'subtitle')}</p>

      {invitations.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {invitations.map((invite) => (
            <li
              key={invite.id}
              className="flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-ink-soft"
            >
              <Icon name="check" size={12} className="text-success" />
              {invite.email}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-ink-faint">{t('buddies', 'emptyBody')}</p>
      )}

      <Field
        label={t('buddies', 'emailsLabel')}
        hint={t('buddies', 'emailsHint')}
        className="mt-3"
        error={error ?? undefined}
      >
        {({ id }) => (
          <Textarea
            id={id}
            rows={2}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="alex@example.com, sam@example.com"
          />
        )}
      </Field>

      {sent ? <p className="mt-1 text-xs font-semibold text-success">{t('buddies', 'sent')}</p> : null}

      <Button size="sm" className="mt-3" disabled={busy || !raw.trim()} onClick={submit}>
        {t('buddies', 'invite')}
      </Button>
    </section>
  );
}
