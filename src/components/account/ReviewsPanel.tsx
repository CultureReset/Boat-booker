'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { reviewCriteria } from '@/config/taxonomy';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { api, errorMessage } from '@/lib/client/api';
import type { ExpandedReview } from '@/lib/services/reviews';
import { useToast } from '@/components/providers/ToastProvider';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import { Badge, Button, EmptyState, Field, Input, LinkButton, PhotoFrame, Stars, Textarea } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Reviews the customer has written, plus the trips still awaiting one.
 *
 * The pending list comes first: a completed trip with no review is the only
 * actionable thing on this screen.
 */

export interface AwaitingReview {
  bookingId: string;
  reference: string;
  date: string;
  charterId: string;
  charterTitle: string;
  photo: { placeholder: string; altText: string } | null;
}

export function ReviewsPanel({
  reviews: initialReviews,
  awaiting: initialAwaiting,
}: {
  reviews: ExpandedReview[];
  awaiting: AwaitingReview[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [reviews, setReviews] = useState(initialReviews);
  const [awaiting, setAwaiting] = useState(initialAwaiting);
  const [target, setTarget] = useState<AwaitingReview | null>(null);

  const onSubmitted = (review: ExpandedReview, bookingId: string) => {
    setReviews((current) => [review, ...current]);
    setAwaiting((current) => current.filter((item) => item.bookingId !== bookingId));
    setTarget(null);
    toast(t('reviews', 'thanksTitle'), 'success');
    router.refresh();
  };

  return (
    <>
      {awaiting.length ? (
        <section className="mb-6">
          <h2 className="mb-3 text-base font-bold text-ink">{t('reviews', 'pendingTitle')}</h2>
          <ul className="space-y-2">
            {awaiting.map((item) => (
              <li
                key={item.bookingId}
                className="flex items-center gap-3 rounded-card border border-line bg-white p-3"
              >
                <PhotoFrame photo={item.photo} rounded="rounded-lg" className="h-14 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{item.charterTitle}</p>
                  <p className="text-xs text-ink-muted">{formatDate(item.date, 'medium')}</p>
                </div>
                <Button size="sm" onClick={() => setTarget(item)} className="shrink-0">
                  {t('bookings', 'leaveReview')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2 className="mb-3 text-base font-bold text-ink">{t('reviews', 'title')}</h2>

      {reviews.length === 0 ? (
        <EmptyState
          icon="star-empty"
          title={t('reviews', 'emptyTitle')}
          body={t('reviews', 'emptyBody')}
          action={<LinkButton href="/account/bookings">{t('bookings', 'title')}</LinkButton>}
        />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-card border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-ink">
                    {review.charter ? (
                      <Link href={`/charters/view/${review.charter.id}`} className="hover:underline">
                        {review.charter.title}
                      </Link>
                    ) : (
                      t('reviews', 'title')
                    )}
                  </h3>
                  <p className="mt-0.5 flex items-center gap-2">
                    <Stars rating={review.rating} size={13} />
                    <span className="text-xs text-ink-muted">
                      {formatDate(review.createdAt.slice(0, 10), 'medium')}
                    </span>
                  </p>
                </div>
                {review.verified ? (
                  <Badge tone="success" icon="check">{t('viewCharter', 'verifiedReview')}</Badge>
                ) : null}
              </div>

              <h4 className="mt-2.5 text-sm font-bold text-ink">{review.headline}</h4>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{review.body}</p>

              {review.ownerResponse ? (
                <div className="mt-3 rounded-control border-l-2 border-brand-400 bg-surface-sunken px-3 py-2">
                  <p className="text-xs font-bold text-ink">{t('viewCharter', 'captainReplied')}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{review.ownerResponse}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ReviewComposer target={target} onClose={() => setTarget(null)} onSubmitted={onSubmitted} />
    </>
  );
}

function ReviewComposer({
  target,
  onClose,
  onSubmitted,
}: {
  target: AwaitingReview | null;
  onClose: () => void;
  onSubmitted: (review: ExpandedReview, bookingId: string) => void;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = reviewCriteria.every((criterion) => (ratings[criterion.key] ?? 0) > 0);
  const valid = complete && headline.trim().length >= 3 && body.trim().length >= 10;

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const review = await api.post<ExpandedReview>('/api/reviews', {
        bookingId: target.bookingId,
        headline,
        body,
        ratings,
      });
      // Reset for the next one rather than leaving stale text behind.
      setRatings({});
      setHeadline('');
      setBody('');
      onSubmitted(review, target.bookingId);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay
      open={Boolean(target)}
      onClose={onClose}
      title={t('reviews', 'writeReviewTitle', { owner: target?.charterTitle ?? '' })}
      size="md"
      footer={
        <Button fullWidth onClick={submit} loading={busy} disabled={!valid}>
          {t('reviews', 'submitReview')}
        </Button>
      }
    >
      {error ? (
        <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        {reviewCriteria.map((criterion) => (
          <div key={criterion.key}>
            <p className="mb-1.5 text-sm font-semibold text-ink">{criterion.title}</p>
            <StarInput
              value={ratings[criterion.key] ?? 0}
              onChange={(value) => setRatings((current) => ({ ...current, [criterion.key]: value }))}
              label={t('reviews', 'rateCriterion', { criterion: criterion.title })}
            />
          </div>
        ))}

        <Field label={t('reviews', 'reviewHeadline')} required>
          {({ id }) => (
            <Input
              id={id}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={t('reviews', 'reviewHeadlinePlaceholder')}
              maxLength={120}
            />
          )}
        </Field>

        <Field label={t('reviews', 'reviewBody')} required hint={t('reviews', 'reviewGuidelines')}>
          {({ id }) => (
            <Textarea
              id={id}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder={t('reviews', 'reviewBodyPlaceholder')}
              maxLength={4000}
            />
          )}
        </Field>
      </div>
    </Overlay>
  );
}

/** Keyboard-operable 1–5 star input. */
function StarInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={t('reviews', 'starsLabel', { count: star })}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onFocus={() => setHover(star)}
          onBlur={() => setHover(0)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Icon
            name={star <= shown ? 'star' : 'star-empty'}
            size={26}
            strokeWidth={star <= shown ? 0 : 1.6}
            className={cx(star <= shown ? 'text-gold' : 'text-slate-300')}
          />
        </button>
      ))}
      {shown > 0 ? (
        <span className="ml-2 text-sm font-semibold text-ink-soft">
          {t('reviews', ratingWord(shown))}
        </span>
      ) : null}
    </div>
  );
}

function ratingWord(value: number): string {
  return (
    ['ratingPoor', 'ratingFair', 'ratingGood', 'ratingVeryGood', 'ratingExcellent'][value - 1] ??
    'ratingGood'
  );
}
