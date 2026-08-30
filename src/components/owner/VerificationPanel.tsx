'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/providers/ToastProvider';
import type { VerificationState } from '@/lib/domain/types';
import { Icon } from '@/components/ui/Icon';
import { Badge, Button, Field, Input, Select } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Profile verification.
 *
 * There is no file storage in this build, so a document is recorded by name
 * rather than uploaded — the state machine (unverified → pending → verified)
 * is the part that matters and is fully wired.
 */
const DOCUMENT_KINDS = [
  { key: 'license', label: 'Captain licence' },
  { key: 'insurance', label: 'Insurance certificate' },
  { key: 'identity', label: 'Photo ID' },
] as const;

export function VerificationPanel({ verification: initial }: { verification: VerificationState }) {
  const router = useRouter();
  const { toast } = useToast();

  const [verification, setVerification] = useState(initial);
  const [kind, setKind] = useState<(typeof DOCUMENT_KINDS)[number]['key']>('license');
  const [filename, setFilename] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.post<VerificationState>('/api/owner/verification', {
        documents: [{ kind, filename }],
      });
      setVerification(updated);
      setFilename('');
      toast(t('owner', 'verificationStatusPending'), 'success');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const statusTone =
    verification.status === 'verified' ? 'success'
    : verification.status === 'pending' ? 'warning'
    : 'neutral';

  const statusLabel =
    verification.status === 'verified' ? t('owner', 'verificationStatusVerified')
    : verification.status === 'pending' ? t('owner', 'verificationStatusPending')
    : t('owner', 'verificationStatusUnverified');

  return (
    <div className="max-w-xl space-y-4">
      <section
        className={cx(
          'rounded-card border p-4',
          verification.status === 'verified' ? 'border-success/40 bg-emerald-50/50' : 'border-line bg-white',
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cx(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
              verification.status === 'verified'
                ? 'bg-emerald-100 text-success'
                : verification.status === 'pending'
                  ? 'bg-amber-100 text-warning'
                  : 'bg-surface-sunken text-ink-muted',
            )}
          >
            <Icon name="shield" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-base font-bold text-ink">
              {t('owner', 'verificationTitle')}
              <Badge tone={statusTone}>{statusLabel}</Badge>
            </p>
            <p className="mt-1 text-sm text-ink-muted">{t('owner', 'verificationBody')}</p>
          </div>
        </div>
      </section>

      {verification.documents.length ? (
        <section className="rounded-card border border-line bg-white p-4">
          <h2 className="mb-2 text-sm font-bold text-ink">{t('owner', 'uploadDocument')}</h2>
          <ul className="space-y-2">
            {verification.documents.map((document) => (
              <li key={document.id} className="flex items-center gap-3 rounded-control border border-line p-2.5">
                <Icon name="check-circle" size={17} className="shrink-0 text-success" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{document.filename}</p>
                  <p className="text-xs text-ink-muted">
                    {DOCUMENT_KINDS.find((k) => k.key === document.kind)?.label} ·{' '}
                    {formatDate(document.uploadedAt.slice(0, 10), 'medium')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {verification.status !== 'verified' ? (
        <section className="rounded-card border border-line bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-ink">{t('owner', 'uploadDocument')}</h2>

          {error ? (
            <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <div className="space-y-4">
            <Field label={t('owner', 'uploadDocument')}>
              {({ id }) => (
                <Select
                  id={id}
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                >
                  {DOCUMENT_KINDS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={t('owner', 'documentFileName')} required>
              {({ id }) => (
                <Input
                  id={id}
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="captain-licence-2026.pdf"
                />
              )}
            </Field>
          </div>

          <Button className="mt-4" onClick={submit} loading={busy} disabled={filename.trim().length < 3}>
            {t('general', 'submit')}
          </Button>

          <p className="mt-2 text-xs text-ink-muted">
            This build records the document name only; connecting object storage turns this into a real upload.
          </p>
        </section>
      ) : null}
    </div>
  );
}
