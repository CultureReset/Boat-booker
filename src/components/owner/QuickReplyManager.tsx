'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import { Button, EmptyState, Field, Input, Textarea } from '@/components/ui/primitives';
import type { QuickReply } from '@/lib/domain/types';

/**
 * Quick Replies.
 *
 * The placeholder chips insert at the cursor rather than appending, because an
 * operator writing "Hi , thanks for booking" wants the name in the gap they
 * left, not at the end. Placeholders that a thread cannot fill stay visible in
 * the composed message rather than blanking, so a missing value is caught
 * before sending instead of after.
 */
export function QuickReplyManager({
  replies: initial,
  placeholders,
}: {
  replies: QuickReply[];
  placeholders: readonly string[];
}) {
  const router = useRouter();

  const [replies, setReplies] = useState(initial);
  const [editing, setEditing] = useState<Partial<QuickReply> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuickReply | null>(null);
  const [cursor, setCursor] = useState(0);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await api.post<QuickReply>('/api/owner/quick-replies', {
        id: editing.id,
        title: editing.title,
        body: editing.body,
      });
      setReplies((current) =>
        [...current.filter((r) => r.id !== saved.id), saved].sort((a, b) =>
          a.title.localeCompare(b.title),
        ),
      );
      setEditing(null);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (reply: QuickReply) => {
    setBusy(true);
    try {
      await api.post('/api/owner/quick-replies', { id: reply.id, remove: true });
      setReplies((current) => current.filter((r) => r.id !== reply.id));
      setConfirmDelete(null);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const insertPlaceholder = (name: string) => {
    const body = editing?.body ?? '';
    const token = `{{${name}}}`;
    const at = Math.min(cursor, body.length);
    setEditing({ ...editing, body: `${body.slice(0, at)}${token}${body.slice(at)}` });
    setCursor(at + token.length);
  };

  return (
    <div className="space-y-3">
      {replies.length === 0 ? (
        <EmptyState
          icon="bolt"
          title={t('quickReplies', 'emptyTitle')}
          body={t('quickReplies', 'emptyBody')}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
          {replies.map((reply) => (
            <li key={reply.id} className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">{reply.title}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-muted">{reply.body}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(reply);
                    setCursor(reply.body.length);
                  }}
                  aria-label={t('general', 'edit')}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-surface-sunken"
                >
                  <Icon name="edit" size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(reply)}
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

      <Button
        variant="secondary"
        onClick={() => {
          setEditing({ title: '', body: '' });
          setCursor(0);
        }}
      >
        <Icon name="plus" size={15} />
        {t('quickReplies', 'add')}
      </Button>

      <Overlay
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t('quickReplies', editing?.id ? 'edit' : 'add')}
      >
        {editing ? (
          <div className="space-y-3">
            <Field label={t('quickReplies', 'templateTitle')} hint={t('quickReplies', 'titleHint')}>
              {({ id }) => (
                <Input
                  id={id}
                  value={editing.title ?? ''}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder={t('quickReplies', 'templateTitlePlaceholder')}
                />
              )}
            </Field>

            <Field label={t('quickReplies', 'message')}>
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={5}
                  value={editing.body ?? ''}
                  onChange={(e) => {
                    setEditing({ ...editing, body: e.target.value });
                    setCursor(e.target.selectionStart ?? e.target.value.length);
                  }}
                  onSelect={(e) =>
                    setCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0)
                  }
                  placeholder={t('quickReplies', 'messagePlaceholder')}
                />
              )}
            </Field>

            <div>
              <p className="text-xs font-bold text-ink">{t('quickReplies', 'placeholdersTitle')}</p>
              <p className="text-xs text-ink-muted">{t('quickReplies', 'placeholdersBody')}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {placeholders.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => insertPlaceholder(name)}
                    className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft transition-colors hover:bg-surface-sunken"
                  >
                    {`{{${name}}}`}
                  </button>
                ))}
              </div>
            </div>

            {error ? (
              <p role="alert" className="text-sm font-semibold text-danger">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>
                {t('general', 'cancel')}
              </Button>
              <Button className="flex-1" disabled={busy} onClick={save}>
                {t('general', 'save')}
              </Button>
            </div>
          </div>
        ) : null}
      </Overlay>

      <Overlay
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={t('quickReplies', 'deleteTitle')}
      >
        <p className="text-sm text-ink-soft">{t('quickReplies', 'deleteBody')}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>
            {t('general', 'cancel')}
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={busy}
            onClick={() => confirmDelete && remove(confirmDelete)}
          >
            {t('general', 'delete')}
          </Button>
        </div>
      </Overlay>
    </div>
  );
}
