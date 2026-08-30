'use client';

import { useState } from 'react';
import Link from 'next/link';
import { translate as t } from '@/i18n/translate';
import { engineTypes, fuelTypes, paymentMethods, reviewCriteria } from '@/config/taxonomy';
import { formatDate, timeAgo } from '@/lib/core/dates';
import { api, errorMessage } from '@/lib/client/api';
import type { CharterDetail } from '@/lib/services/charters';
import type { ExpandedReview } from '@/lib/services/reviews';
import type { ReviewStatistics } from '@/lib/domain/types';
import { useSession } from '@/components/providers/SessionProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import { Badge, Button, Divider, Stars, Textarea } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import { AuthModal } from '@/components/auth/AuthModal';

/**
 * The content sections of a listing page.
 *
 * Split out from the route so the page itself stays a thin server component
 * that only fetches and lays out; anything needing state (expandable
 * description, review paging, the message-owner sheet) lives here.
 */

// --- Description -----------------------------------------------------------

export function DescriptionSection({ charter }: { charter: CharterDetail }) {
  const [expanded, setExpanded] = useState(false);
  const paragraphs = charter.longDescription.split('\n\n').filter(Boolean);
  const isLong = charter.longDescription.length > 420;

  return (
    <section aria-labelledby="about-heading">
      <h2 id="about-heading" className="mb-3 text-lg font-bold text-ink">
        {t('viewCharter', 'aboutThisBoat')}
      </h2>
      <div className={cx('space-y-3 text-sm leading-relaxed text-ink-soft', !expanded && isLong && 'line-clamp-3')}>
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
        >
          {expanded ? t('general', 'seeLess') : t('general', 'seeMore')}
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
        </button>
      ) : null}
    </section>
  );
}

// --- Boat specifications ---------------------------------------------------

export function BoatSection({ charter }: { charter: CharterDetail }) {
  const boat = charter.boat;

  const specs: { label: string; value: string | number | undefined }[] = [
    { label: t('viewCharter', 'boatLength'), value: t('listingCard', 'length', { p: boat.length }) },
    { label: t('viewCharter', 'boatCapacity'), value: t('listingCard', 'capacity', { count: boat.capacity, p: boat.capacity }) },
    { label: t('boatTypes', 'category'), value: boat.category },
    { label: t('viewCharter', 'manufacturer'), value: boat.manufacturer },
    { label: t('viewCharter', 'model'), value: boat.boatModel },
    { label: t('viewCharter', 'yearBuilt'), value: boat.yearBuilt },
    { label: t('viewCharter', 'engineCount'), value: boat.engineCount },
    { label: t('viewCharter', 'enginePower'), value: boat.engineHorsepower ? t('viewCharter', 'hp', { p: boat.engineHorsepower }) : undefined },
    { label: t('viewCharter', 'maxSpeed'), value: boat.maxSpeed ? t('viewCharter', 'knots', { p: boat.maxSpeed }) : undefined },
    { label: t('viewCharter', 'engineType'), value: engineTypes.find((e) => e.key === boat.engineType)?.title },
    { label: t('viewCharter', 'fuelType'), value: fuelTypes.find((f) => f.key === boat.fuelType)?.title },
    { label: t('viewCharter', 'cabins'), value: boat.numberOfCabins || undefined },
    { label: t('viewCharter', 'berths'), value: boat.numberOfBerths || undefined },
    { label: t('viewCharter', 'heads'), value: boat.numberOfHeads || undefined },
  ].filter((spec) => spec.value !== undefined && spec.value !== '');

  return (
    <section aria-labelledby="boat-heading">
      <h2 id="boat-heading" className="mb-3 text-lg font-bold text-ink">
        {t('viewCharter', 'theBoat')}
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
        {specs.map((spec) => (
          <div key={spec.label} className="border-b border-line pb-2">
            <dt className="text-xs text-ink-muted">{spec.label}</dt>
            <dd className="text-sm font-semibold text-ink">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// --- Amenities and rules ---------------------------------------------------

export function AmenitiesSection({ charter }: { charter: CharterDetail }) {
  const [open, setOpen] = useState(false);

  const equipment = charter.amenitySections.filter((section) => section.group !== 'rules');
  const rules = charter.amenitySections.find((section) => section.group === 'rules');

  // Show a preview on the page; the full set goes in a sheet so the page does
  // not become a wall of check marks.
  const preview = equipment.flatMap((section) => section.items).filter((item) => item.active).slice(0, 10);
  const totalActive = equipment.reduce(
    (sum, section) => sum + section.items.filter((item) => item.active).length,
    0,
  );

  return (
    <section aria-labelledby="amenities-heading">
      <h2 id="amenities-heading" className="mb-3 text-lg font-bold text-ink">
        {t('viewCharter', 'whatsOnBoard')}
      </h2>

      <ul className="grid grid-cols-2 gap-y-2.5 sm:grid-cols-3">
        {preview.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-sm text-ink-soft">
            <Icon name={item.icon} size={16} className="shrink-0 text-ink-muted" />
            {item.title}
          </li>
        ))}
      </ul>

      {totalActive > preview.length ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
          {t('general', 'showXMore', { count: totalActive - preview.length })}
        </Button>
      ) : null}

      {rules?.items.length ? (
        <>
          <Divider className="my-5" />
          <h3 className="mb-3 text-base font-bold text-ink">{t('viewCharter', 'boatRules')}</h3>
          <ul className="grid grid-cols-2 gap-y-2.5 sm:grid-cols-3">
            {rules.items.map((item) => (
              <li
                key={item.key}
                className={cx('flex items-center gap-2 text-sm', item.active ? 'text-ink-soft' : 'text-ink-faint')}
              >
                <Icon
                  name={item.active ? 'check' : 'close'}
                  size={15}
                  className={cx('shrink-0', item.active ? 'text-success' : 'text-ink-faint')}
                />
                <span className={cx(!item.active && 'line-through')}>{item.title}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <Overlay open={open} onClose={() => setOpen(false)} title={t('viewCharter', 'whatsOnBoard')} size="lg">
        <div className="space-y-5">
          {equipment.map((section) => {
            const active = section.items.filter((item) => item.active);
            if (!active.length) return null;
            return (
              <section key={section.group}>
                <h3 className="mb-2 text-sm font-bold text-ink">{section.title}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {active.map((item) => (
                    <li key={item.key} className="flex items-center gap-2 text-sm text-ink-soft">
                      <Icon name={item.icon} size={16} className="text-ink-muted" />
                      {item.title}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </Overlay>
    </section>
  );
}

// --- Owner -----------------------------------------------------------------

export function OwnerSection({ charter }: { charter: CharterDetail }) {
  const { user } = useSession();
  const { toast } = useToast();

  const [messageOpen, setMessageOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    setSending(true);
    setError(null);
    try {
      await api.post('/api/inbox', { charterId: charter.id, body });
      setMessageOpen(false);
      setBody('');
      toast(t('inbox', 'sent'), 'success');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  };

  const responseHours = Math.round(charter.owner.averageResponseTimeSeconds / 3600);

  return (
    <section aria-labelledby="owner-heading">
      <h2 id="owner-heading" className="mb-3 text-lg font-bold text-ink">
        {t('viewCharter', 'meetTheCaptain')}
      </h2>

      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-800">
          {charter.owner.displayName
            .split(' ')
            .slice(0, 2)
            .map((part) => part[0])
            .join('')}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-base font-bold text-ink">
            {charter.owner.displayName}
            {charter.owner.verified ? (
              <Badge tone="success" icon="shield">{t('viewCharter', 'verifiedOperator')}</Badge>
            ) : null}
          </p>
          <p className="text-sm text-ink-muted">{charter.owner.companyName}</p>

          <ul className="mt-2 space-y-1 text-sm text-ink-soft">
            {charter.owner.yearStartedRunningCharters ? (
              <li className="flex items-center gap-2">
                <Icon name="clock" size={14} className="text-ink-muted" />
                {t('viewCharter', 'captainSince', { year: charter.owner.yearStartedRunningCharters })}
              </li>
            ) : null}
            <li className="flex items-center gap-2">
              <Icon name="globe" size={14} className="text-ink-muted" />
              {t('viewCharter', 'captainLanguages', { languages: charter.owner.languages })}
            </li>
            <li className="flex items-center gap-2">
              <Icon name="boat" size={14} className="text-ink-muted" />
              {t('viewCharter', 'captainListings', {
                count: charter.owner.listingCount,
                p: charter.owner.listingCount,
              })}
            </li>
            {charter.owner.responseRate > 0 ? (
              <li className="flex items-center gap-2">
                <Icon name="message" size={14} className="text-ink-muted" />
                {t('viewCharter', 'responseRate', { rate: charter.owner.responseRate })}
                {responseHours > 0
                  ? ` · ${t('viewCharter', 'responseTime', { time: `${responseHours}h` })}`
                  : ''}
              </li>
            ) : null}
          </ul>

          {charter.owner.background ? (
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{charter.owner.background}</p>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            icon="message"
            className="mt-3"
            onClick={() => (user ? setMessageOpen(true) : setAuthOpen(true))}
          >
            {t('viewCharter', 'messageTheOwner')}
          </Button>
        </div>
      </div>

      <Overlay
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        title={t('viewCharter', 'askAQuestion')}
        size="md"
        footer={
          <Button fullWidth onClick={sendMessage} loading={sending} disabled={body.trim().length < 2}>
            {t('inbox', 'send')}
          </Button>
        }
      >
        <p className="mb-3 text-sm text-ink-muted">
          {charter.owner.displayName} · {charter.title}
        </p>
        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder={t('inbox', 'typeMessage')}
          aria-label={t('inbox', 'typeMessage')}
        />
      </Overlay>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={() => setMessageOpen(true)} />
    </section>
  );
}

// --- Location --------------------------------------------------------------

export function LocationSection({ charter }: { charter: CharterDetail }) {
  return (
    <section aria-labelledby="location-heading">
      <h2 id="location-heading" className="mb-3 text-lg font-bold text-ink">
        {t('viewCharter', 'whereYoullMeet')}
      </h2>

      <p className="mb-3 flex items-start gap-2 text-sm text-ink-soft">
        <Icon name="map-pin" size={16} className="mt-0.5 shrink-0 text-ink-muted" />
        <span>
          {charter.exactAddress ?? charter.approximateAddress}
          {!charter.exactAddress ? (
            <span className="mt-1 block text-xs text-ink-muted">
              {t('viewCharter', 'exactAddressAfterBooking')}
            </span>
          ) : null}
        </span>
      </p>

      {/* A schematic locator rather than a tile map — no API key, works offline. */}
      <div className="relative h-44 overflow-hidden rounded-card bg-[#dfeaf3]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="loc-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M10 0H0V10" fill="none" stroke="#c3d7e6" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#loc-grid)" />
          <path d="M0 62 Q22 54 44 60 T78 56 T100 64 L100 100 L0 100 Z" fill="#e8efe4" />
        </svg>

        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop">
            <Icon name="map-pin" size={18} />
          </span>
        </span>

        {/* Radius circle, reinforcing that the pin is approximate. */}
        {!charter.exactAddress ? (
          <span className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-500/40 bg-brand-500/10" />
        ) : null}

        <span className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-[10px] text-ink-muted">
          {charter.geoPoint.lat.toFixed(3)}, {charter.geoPoint.lon.toFixed(3)}
        </span>
      </div>

      {charter.directions ? (
        <>
          <h3 className="mb-1 mt-4 text-sm font-bold text-ink">{t('viewCharter', 'directions')}</h3>
          <p className="text-sm leading-relaxed text-ink-soft">{charter.directions}</p>
        </>
      ) : null}
    </section>
  );
}

// --- Policies --------------------------------------------------------------

export function PoliciesSection({ charter }: { charter: CharterDetail }) {
  const freeDays = charter.policies.freeCancellationDaysInAdvance;

  const accepted = paymentMethods.filter((method) =>
    charter.policies.acceptedPaymentMethods.includes(method.key),
  );

  return (
    <section aria-labelledby="policies-heading">
      <h2 id="policies-heading" className="mb-3 text-lg font-bold text-ink">
        {t('viewCharter', 'cancellationPolicy')}
      </h2>

      <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
        <Icon
          name={freeDays > 0 ? 'check-circle' : 'info'}
          size={16}
          className={cx('mt-0.5 shrink-0', freeDays > 0 ? 'text-success' : 'text-ink-muted')}
        />
        {freeDays > 0
          ? t('viewCharter', 'cancellationDaysNotice', { count: freeDays, p: freeDays })
          : t('viewCharter', 'cancellationDepositNonRefundable')}
      </p>

      <h3 className="mb-2 mt-5 text-base font-bold text-ink">{t('viewCharter', 'paymentMethodsTitle')}</h3>
      <ul className="flex flex-wrap gap-2">
        {accepted.map((method) => (
          <li key={method.key}>
            <Badge tone="neutral" icon={method.online ? 'card' : 'wallet'}>
              {method.title}
            </Badge>
          </li>
        ))}
      </ul>

      <ul className="mt-4 space-y-2 text-sm text-ink-soft">
        <li className="flex items-start gap-2">
          <Icon name={charter.policies.fuelIncludedInPrice ? 'check' : 'close'} size={15} className="mt-0.5 shrink-0 text-ink-muted" />
          {charter.policies.fuelIncludedInPrice
            ? t('packageCard', 'fuelIncluded')
            : t('packageCard', 'fuelNotIncluded')}
        </li>
        {charter.policies.hasSecurityDeposit ? (
          <li className="flex items-start gap-2">
            <Icon name="wallet" size={15} className="mt-0.5 shrink-0 text-ink-muted" />
            {t('packageCard', 'securityDepositNote')}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

// --- Reviews ---------------------------------------------------------------

export function ReviewsSection({
  charterId,
  statistics,
  initialReviews,
  totalCount,
}: {
  charterId: string;
  statistics: ReviewStatistics;
  initialReviews: ExpandedReview[];
  totalCount: number;
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    try {
      const result = await api.getWithMeta<{ reviews: ExpandedReview[] }>(
        `/api/charters/${charterId}/reviews?page=${page + 1}&per_page=10`,
      );
      setReviews((current) => [...current, ...result.data.reviews]);
      setPage((p) => p + 1);
    } catch {
      // Leave what is already shown; the button stays available to retry.
    } finally {
      setLoading(false);
    }
  };

  if (statistics.reviewCount === 0) {
    return (
      <section aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="mb-3 text-lg font-bold text-ink">
          {t('viewCharter', 'reviewsTitle')}
        </h2>
        <div className="rounded-card border border-dashed border-line p-6 text-center">
          <p className="text-sm font-semibold text-ink">{t('viewCharter', 'noReviewsTitle')}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('viewCharter', 'noReviewsBody')}</p>
        </div>
      </section>
    );
  }

  const maxBucket = Math.max(...Object.values(statistics.stars), 1);

  return (
    <section aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="mb-3 text-lg font-bold text-ink">
        {t('viewCharter', 'reviewsTitle')}
      </h2>

      <div className="mb-5 grid gap-5 sm:grid-cols-2">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-extrabold tabular-nums text-ink">
              {statistics.rating.toFixed(1)}
            </span>
            <span>
              <Stars rating={statistics.rating} size={16} />
              <span className="mt-0.5 block text-xs text-ink-muted">
                {t('listingCard', 'reviewCount', { count: statistics.reviewCount, p: statistics.reviewCount })}
              </span>
            </span>
          </div>

          <ul className="mt-3 space-y-1">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = statistics.stars[String(star) as '1'] ?? 0;
              return (
                <li key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular-nums text-ink-muted">{star}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <span
                      className="block h-full rounded-full bg-gold"
                      style={{ width: `${(count / maxBucket) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 text-right tabular-nums text-ink-muted">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <dl className="space-y-2.5">
          {reviewCriteria.map((criterion) => {
            const value = statistics[criterion.key];
            return (
              <div key={criterion.key} className="flex items-center justify-between gap-3">
                <dt className="text-sm text-ink-soft">{criterion.title}</dt>
                <dd className="flex items-center gap-2">
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${(value / 5) * 100}%` }} />
                  </span>
                  <span className="w-7 text-right text-sm font-semibold tabular-nums text-ink">
                    {value.toFixed(1)}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      <ul className="space-y-5">
        {reviews.map((review) => (
          <li key={review.id} className="border-t border-line pt-5 first:border-0 first:pt-0">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-xs font-bold text-ink-soft">
                {review.author.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-bold text-ink">{review.author.displayName}</span>
                  {review.verified ? (
                    <Badge tone="success" icon="check">{t('viewCharter', 'verifiedReview')}</Badge>
                  ) : null}
                </p>
                <p className="mt-0.5 flex items-center gap-2">
                  <Stars rating={review.rating} size={12} />
                  <span className="text-xs text-ink-muted">
                    {t('viewCharter', 'reviewedOn', { date: formatDate(review.createdAt.slice(0, 10), 'medium') })}
                  </span>
                </p>
                <h3 className="mt-2 text-sm font-bold text-ink">{review.headline}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{review.body}</p>

                {review.ownerResponse ? (
                  <div className="mt-3 rounded-control border-l-2 border-brand-400 bg-surface-sunken px-3 py-2">
                    <p className="text-xs font-bold text-ink">{t('viewCharter', 'captainReplied')}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">{review.ownerResponse}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {reviews.length < totalCount ? (
        <Button variant="outline" className="mt-5" onClick={loadMore} loading={loading}>
          {t('viewCharter', 'seeAllReviews', { count: totalCount })}
        </Button>
      ) : null}
    </section>
  );
}

// --- Similar listings ------------------------------------------------------

export function SimilarSection({
  charters,
}: {
  charters: { id: string; title: string; photo: { placeholder: string; altText: string }; price?: string; boatType: string }[];
}) {
  if (!charters.length) return null;

  return (
    <section aria-labelledby="similar-heading">
      <h2 id="similar-heading" className="mb-3 text-lg font-bold text-ink">
        {t('viewCharter', 'similarListings')}
      </h2>
      <ul className="rail md:grid md:grid-cols-4 md:overflow-visible">
        {charters.map((charter) => (
          <li key={charter.id} className="w-44 shrink-0 md:w-auto">
            <Link href={`/charters/view/${charter.id}`} className="group block">
              <span
                className="block aspect-[4/3] w-full rounded-card bg-slate-200 transition-transform group-hover:scale-[1.02]"
                style={{ backgroundImage: charter.photo.placeholder }}
                aria-hidden="true"
              />
              <span className="mt-1.5 block truncate text-sm font-semibold text-ink">{charter.title}</span>
              <span className="block text-xs text-ink-muted">
                {charter.boatType}
                {charter.price ? ` · ${t('listingCard', 'priceFrom', { price: charter.price })}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Small "reported N ago" helper reused by the header. */
export function LastUpdated({ iso }: { iso: string }) {
  return <span className="text-xs text-ink-faint">{t('search', 'lastBooking_X_ago', { p: timeAgo(iso) })}</span>;
}
