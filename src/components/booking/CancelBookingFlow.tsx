'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { formatMoney } from '@/lib/core/money';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Button, Field, Radio, Textarea } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import type { PenaltyImpact } from '@/lib/domain/types';

/**
 * Cancellation, with the consequences shown before the button.
 *
 * The refund number is the easy half. The half that changes behaviour is the
 * penalty list: an operator sees, *before* confirming, that this particular
 * cancellation will drop their ranking, post an automatic review and cost them
 * an Instant Book strike. Showing that after the fact would be a notification;
 * showing it before is a decision.
 *
 * Nothing is assessed on the client — `preview_cancel` returns the same
 * assessment the mutation will apply, so the screen cannot promise one outcome
 * and deliver another.
 */

export interface CancelReasonOption {
  key: string;
  label: string;
  group: string;
  followUp?: string;
}

interface Preview {
  refund: number;
  forfeited: number;
  free: boolean;
  penaltyFree: boolean;
  supportReview: boolean;
  impact: PenaltyImpact;
  impactLabel: string;
  penalties: { key: string; impact: PenaltyImpact; title: string; body: string }[];
  suspension: { mode: 'booking_limit' | 'paused'; current?: number; limit?: number } | null;
  followUp: string | null;
}

const IMPACT_TONE: Record<PenaltyImpact, string> = {
  none: 'text-success',
  low: 'text-ink-soft',
  medium: 'text-warning',
  high: 'text-danger',
  very_high: 'text-danger',
};

export function CancelBookingFlow({
  bookingId,
  role,
  currency,
  reasons,
  canRequestChange,
}: {
  bookingId: string;
  role: 'customer' | 'owner';
  currency: string;
  reasons: CancelReasonOption[];
  canRequestChange: boolean;
}) {
  const router = useRouter();

  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const backHref = `${role === 'owner' ? '/owner' : '/account'}/bookings/${bookingId}`;

  const groups = reasons.reduce<Record<string, CancelReasonOption[]>>((acc, option) => {
    (acc[option.group] ??= []).push(option);
    return acc;
  }, {});

  const loadPreview = async (nextReason: string) => {
    setReason(nextReason);
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<Preview>(`/api/bookings/${bookingId}`, {
        action: 'preview_cancel',
        reason: nextReason,
      });
      setPreview(result);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/bookings/${bookingId}`, { action: 'cancel', reason, note });
      setDone(true);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-card border border-line bg-white p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-ink-soft">
          <Icon name="check-circle" size={26} />
        </span>
        <h2 className="mt-3 text-lg font-bold text-ink">{t('cancel', 'cancelledTitle')}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t('cancel', 'cancelledBody')}</p>
        <Link
          href={backHref}
          className="mt-4 inline-block rounded-control bg-brand-600 px-5 py-2.5 text-sm font-bold text-white"
        >
          {t('changeBooking', 'backToBooking')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-line bg-white p-4">
        <h2 className="text-base font-bold text-ink">
          {t('cancel', role === 'owner' ? 'reasonHeadingOwner' : 'reasonHeadingCustomer')}
        </h2>

        <div className="mt-3 space-y-4">
          {Object.entries(groups).map(([group, options]) => (
            <fieldset key={group}>
              <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                {group}
              </legend>
              <div className="space-y-1">
                {options.map((option) => (
                  <Radio
                    key={option.key}
                    name="cancel-reason"
                    label={option.label}
                    checked={reason === option.key}
                    onChange={() => loadPreview(option.key)}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      {/* A change is almost always better than a cancellation for both sides,
          so it is offered the moment the reason says the details are wrong. */}
      {preview?.followUp && canRequestChange ? (
        <section className="rounded-card border border-brand-200 bg-brand-50/60 p-4">
          <p className="text-sm font-semibold text-ink">{t('cancel', 'considerChanging')}</p>
          <Link
            href={`${backHref}/change`}
            className="mt-2 inline-block rounded-control bg-brand-600 px-4 py-2 text-sm font-bold text-white"
          >
            {t('cancel', 'changeInstead')}
          </Link>
        </section>
      ) : null}

      {preview ? (
        <section className="rounded-card border border-line bg-white p-4">
          <h3 className="text-sm font-bold text-ink">{t('cancel', 'whatHappensNext')}</h3>

          <div className="mt-3 rounded-lg bg-surface-sunken p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t('cancel', 'refundTitle')}
            </p>
            <p className="mt-1 text-sm text-ink">
              {preview.supportReview
                ? t('cancel', 'refundReview')
                : preview.free
                  ? t('cancel', 'refundFull')
                  : preview.refund > 0
                    ? t('cancel', 'refundPartial')
                    : t('cancel', 'refundNone')}
            </p>
            {preview.refund > 0 ? (
              <p className="mt-1 text-lg font-bold text-success">
                {formatMoney(preview.refund, currency)}
              </p>
            ) : null}
          </div>

          {role === 'owner' ? (
            preview.penaltyFree ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-success/10 p-3">
                <Icon name="check-circle" size={16} className="mt-0.5 shrink-0 text-success" />
                <span>
                  <span className="block text-sm font-bold text-ink">
                    {t('cancel', 'penaltyFreeTitle')}
                  </span>
                  <span className="block text-xs text-ink-soft">
                    {t('cancel', 'penaltyFreeBody')}
                  </span>
                </span>
              </div>
            ) : (
              <div className="mt-3">
                <p className={cx('text-sm font-bold', IMPACT_TONE[preview.impact])}>
                  {preview.impactLabel}
                </p>
                <p className="mt-1 text-xs text-ink-soft">{t('cancel', 'penaltiesIntro')}</p>

                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="mt-2 text-xs font-semibold text-brand-700"
                >
                  {t('cancel', showDetails ? 'hideDetails' : 'showDetails')}
                </button>

                {showDetails ? (
                  <ul className="mt-2 space-y-2">
                    {preview.penalties.map((penalty) => (
                      <li key={penalty.key} className="flex items-start gap-2">
                        <Icon
                          name={penalty.impact === 'none' ? 'info' : 'alert'}
                          size={15}
                          className={cx('mt-0.5 shrink-0', IMPACT_TONE[penalty.impact])}
                        />
                        <span>
                          <span className="block text-sm font-semibold text-ink">
                            {penalty.title}
                          </span>
                          <span className="block text-xs text-ink-soft">{penalty.body}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {preview.suspension ? (
                  <p className="mt-3 rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger">
                    {preview.suspension.mode === 'paused'
                      ? t('cancel', 'suspensionPaused')
                      : t('cancel', 'suspensionLimit', {
                          current: String(preview.suspension.current ?? 0),
                          limit: String(preview.suspension.limit ?? 0),
                        })}
                  </p>
                ) : null}

                <p className="mt-3 text-xs text-ink-muted">{t('cancel', 'penaltiesAfter')}</p>
              </div>
            )
          ) : null}

          <Field label={t('cancel', 'noteLabel')} className="mt-4">
            {({ id }) => (
              <Textarea
                id={id}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={t('cancel', 'notePlaceholder')}
              />
            )}
          </Field>

          {error ? (
            <p role="alert" className="mt-2 text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Link
              href={backHref}
              className="flex-1 rounded-control border border-line py-2.5 text-center text-sm font-bold text-ink"
            >
              {t('cancel', 'keepBooking')}
            </Link>
            <Button variant="danger" className="flex-1" disabled={busy} onClick={confirm}>
              {busy ? t('cancel', 'cancelling') : t('cancel', 'confirmCancel')}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
