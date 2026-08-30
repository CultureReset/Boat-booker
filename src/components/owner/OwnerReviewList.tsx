'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/providers/ToastProvider';
import type { ExpandedReview } from '@/lib/services/reviews';
import { Overlay } from '@/components/ui/Overlay';
import { Badge, Button, Stars, Textarea } from '@/components/ui/primitives';

/**
 * Owner review list with public responses.
 *
 * A reply is public and permanent, so it goes through a dialog rather than an
 * inline field that could be submitted by a stray Enter key.
 */
export function OwnerReviewList({ reviews: initial }: { reviews: ExpandedReview[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [reviews, setReviews] = useState(initial);
  const [target, setTarget] = useState<ExpandedReview | null>(null);
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.post<ExpandedReview>('/api/reviews', {
        reviewId: target.id,
        response,
      });
      setReviews((current) => current.map((r) => (r.id === updated.id ? updated : r)));
      setTarget(null);
      setResponse('');
      toast(t('reviews', 'responseSubmitted'), 'success');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ul className="space-y-3">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-card border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-xs font-bold text-ink-soft">
                  {review.author.initials}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-bold text-ink">{review.author.displayName}</span>
                    {review.verified ? (
                      <Badge tone="success" icon="check">{t('viewCharter', 'verifiedReview')}</Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2">
                    <Stars rating={review.rating} size={12} />
                    <span className="text-xs text-ink-muted">
                      {formatDate(review.createdAt.slice(0, 10), 'medium')}
                    </span>
                  </p>
                  {review.charter ? (
                    <Link
                      href={`/charters/view/${review.charter.id}`}
                      className="mt-0.5 block truncate text-xs text-ink-muted hover:underline"
                    >
                      {review.charter.title}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <h3 className="mt-2.5 text-sm font-bold text-ink">{review.headline}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{review.body}</p>

            {review.ownerResponse ? (
              <div className="mt-3 rounded-control border-l-2 border-brand-400 bg-surface-sunken px-3 py-2">
                <p className="text-xs font-bold text-ink">{t('viewCharter', 'captainReplied')}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{review.ownerResponse}</p>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                icon="message"
                onClick={() => {
                  setTarget(review);
                  setResponse('');
                }}
              >
                {t('reviews', 'respond')}
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Overlay
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={t('reviews', 'yourResponse')}
        size="md"
        footer={
          <Button fullWidth onClick={submit} loading={busy} disabled={response.trim().length < 2}>
            {t('general', 'submit')}
          </Button>
        }
      >
        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {target ? (
          <div className="mb-3 rounded-control bg-surface-sunken p-3">
            <p className="flex items-center gap-2">
              <Stars rating={target.rating} size={12} />
              <span className="text-xs font-semibold text-ink">{target.author.displayName}</span>
            </p>
            <p className="mt-1 text-sm text-ink-soft">{target.body}</p>
          </div>
        ) : null}

        <Textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={5}
          placeholder={t('reviews', 'yourResponse')}
          aria-label={t('reviews', 'yourResponse')}
          maxLength={2000}
        />
        <p className="mt-2 text-xs text-ink-muted">
          Your response is published publicly beneath the review.
        </p>
      </Overlay>
    </>
  );
}
