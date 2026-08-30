'use client';

import Link from 'next/link';
import { useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { api } from '@/lib/client/api';
import type { CharterCard } from '@/lib/services/charters';
import { useSession } from '@/components/providers/SessionProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { Icon } from '@/components/ui/Icon';
import { Badge, PhotoFrame, RatingSummary } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import { AuthModal } from '@/components/auth/AuthModal';

/**
 * Search result card.
 *
 * The single densest component in the product: it has to carry the photo,
 * price, capacity, rating, trust badges and the save control without becoming
 * unreadable on a 360px screen. Two layouts share this one implementation —
 * a vertical card in the results grid and a horizontal row for the map panel
 * and the wishlist.
 */

export interface ListingCardProps {
  charter: CharterCard;
  /** Carried into the listing URL so the detail page opens on the same query. */
  searchParams?: string;
  layout?: 'grid' | 'row';
  saved?: boolean;
  onToggleSaved?: (charterId: string, saved: boolean) => void;
  /** Position in the result set, announced to screen readers. */
  index?: number;
  total?: number;
  priority?: boolean;
}

export function ListingCard({
  charter,
  searchParams,
  layout = 'grid',
  saved: savedProp,
  onToggleSaved,
  index,
  total,
}: ListingCardProps) {
  const { user } = useSession();
  const { toast } = useToast();

  const [saved, setSaved] = useState(Boolean(savedProp));
  const [authOpen, setAuthOpen] = useState(false);
  const [savePending, setSavePending] = useState(false);

  const href = `/charters/view/${charter.id}${searchParams ? `?${searchParams}` : ''}`;
  const isRow = layout === 'row';

  const toggleSave = async (event: React.MouseEvent) => {
    // The heart sits inside the card link, so stop it navigating.
    event.preventDefault();
    event.stopPropagation();

    if (!user) {
      setAuthOpen(true);
      return;
    }

    // Optimistic: flip immediately, roll back if the write fails.
    const next = !saved;
    setSaved(next);
    setSavePending(true);
    try {
      const result = await api.post<{ saved: boolean }>('/api/wishlist', { charterId: charter.id });
      setSaved(result.saved);
      onToggleSaved?.(charter.id, result.saved);
      toast(result.saved ? t('listingCard', 'addToWishlist') : t('wishlist', 'removed'), 'success');
    } catch {
      setSaved(!next);
      toast(t('general', 'error'), 'error');
    } finally {
      setSavePending(false);
    }
  };

  const priceLabel = charter.minPrice
    ? charter.pricePerPerson
      ? t('listingCard', 'perPerson')
      : t('packageCard', 'entireBoat', { p: charter.capacity })
    : null;

  return (
    <>
      <article
        className={cx(
          'group relative overflow-hidden rounded-card border border-line bg-white transition-shadow hover:shadow-card',
          isRow && 'flex gap-3 p-2',
          !charter.available && 'opacity-70',
        )}
        aria-label={
          index !== undefined && total !== undefined
            ? t('listingCard', 'cardAriaLabel', {
                index: index + 1,
                total,
                title: charter.title,
                price: charter.minPrice?.displayValue ?? '',
              })
            : undefined
        }
      >
        <Link href={href} className="absolute inset-0 z-10" aria-label={charter.title}>
          <span className="sr-only">{charter.title}</span>
        </Link>

        <PhotoFrame
          photo={charter.photo}
          rounded={isRow ? 'rounded-lg' : 'rounded-none'}
          className={cx(isRow ? 'h-24 w-28 shrink-0' : 'aspect-[4/3] w-full')}
        >
          {/* Badges are stacked over the photo, as on the live cards. */}
          <div className="absolute left-2 top-2 z-20 flex flex-wrap gap-1">
            {charter.hasBoatersChoiceAward ? (
              <Badge tone="gold" icon="star">{t('listingCard', 'boatersChoice')}</Badge>
            ) : null}
            {charter.isNew ? <Badge tone="dark">{t('listingCard', 'newBadge')}</Badge> : null}
            {charter.inHighDemand && !charter.isNew ? (
              <Badge tone="warning" icon="bolt">{t('listingCard', 'inHighDemand')}</Badge>
            ) : null}
          </div>

          <button
            type="button"
            onClick={toggleSave}
            disabled={savePending}
            aria-pressed={saved}
            aria-label={saved ? t('listingCard', 'removeFromWishlist') : t('listingCard', 'addToWishlist')}
            className="absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow transition-transform hover:scale-105 active:scale-95"
          >
            <Icon
              name={saved ? 'heart-filled' : 'heart'}
              size={18}
              className={saved ? 'text-danger' : 'text-ink-soft'}
            />
          </button>

          {!charter.available ? (
            <span className="absolute inset-x-0 bottom-0 z-20 bg-ink/80 px-2 py-1 text-center text-[11px] font-semibold text-white">
              {t('search', 'anyDate')} · {t('calendar', 'unavailable')}
            </span>
          ) : null}
        </PhotoFrame>

        <div className={cx('min-w-0', isRow ? 'flex-1 py-0.5' : 'p-3')}>
          <div className="flex items-start justify-between gap-2">
            <h3 className={cx('min-w-0 font-bold text-ink', isRow ? 'text-sm' : 'text-[15px]')}>
              <span className="line-clamp-1">{charter.title}</span>
            </h3>
          </div>

          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
            <Icon name="map-pin" size={12} />
            <span className="truncate">
              {charter.destination.title}
              {charter.destination.stateAbbrev ? `, ${charter.destination.stateAbbrev}` : ''}
            </span>
            {charter.distanceKm !== undefined ? (
              <span className="shrink-0 text-ink-faint">
                · {t('listingCard', 'distanceAway', { distance: formatDistance(charter.distanceKm) })}
              </span>
            ) : null}
          </p>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
            <span className="flex items-center gap-1">
              <Icon name="boat" size={12} />
              {charter.boatType}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="ruler" size={12} />
              {t('listingCard', 'length', { p: charter.length })}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="users" size={12} />
              {t('listingCard', 'capacity', { count: charter.capacity, p: charter.capacity })}
            </span>
          </p>

          {charter.reviewStatistics.reviewCount > 0 ? (
            <div className="mt-1.5">
              <RatingSummary
                rating={charter.reviewStatistics.rating}
                count={charter.reviewStatistics.reviewCount}
                size="sm"
              />
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1">
            {charter.isInstantBookActive ? (
              <Badge tone="brand" icon="bolt">{t('listingCard', 'instantBook')}</Badge>
            ) : null}
            {charter.freeCancellationDaysInAdvance > 0 ? (
              <Badge tone="success" icon="check">{t('listingCard', 'freeCancellation')}</Badge>
            ) : null}
            {charter.verificationBadge ? (
              <Badge tone="neutral" icon="shield">
                {charter.verificationBadge === 'enhanced' ? 'Enhanced check' : 'Basic check'}
              </Badge>
            ) : null}
          </div>

          {charter.minPrice ? (
            <div className="mt-2.5 flex items-baseline justify-between gap-2 border-t border-line pt-2.5">
              <span className="text-xs text-ink-muted">{t('listingCard', 'tripsFrom')}</span>
              <span className="text-right">
                <span className="text-base font-extrabold text-ink">{charter.minPrice.displayValue}</span>
                {priceLabel ? <span className="ml-1 text-xs text-ink-muted">{priceLabel}</span> : null}
              </span>
            </div>
          ) : null}
        </div>
      </article>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          // Save the listing the user was trying to save before signing in.
          void api.post('/api/wishlist', { charterId: charter.id }).then(() => setSaved(true));
        }}
      />
    </>
  );
}

export function ListingCardSkeleton({ layout = 'grid' }: { layout?: 'grid' | 'row' }) {
  const isRow = layout === 'row';
  return (
    <div
      className={cx('overflow-hidden rounded-card border border-line bg-white', isRow && 'flex gap-3 p-2')}
      aria-hidden="true"
    >
      <div className={cx('skeleton', isRow ? 'h-24 w-28 shrink-0 rounded-lg' : 'aspect-[4/3] w-full rounded-none')} />
      <div className={cx('flex-1 space-y-2', isRow ? 'py-1' : 'p-3')}>
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-3 w-2/3" />
        <div className="skeleton h-5 w-1/3" />
      </div>
    </div>
  );
}

/** Distances read in miles for US visitors and kilometres elsewhere. */
function formatDistance(km: number): string {
  if (typeof navigator !== 'undefined' && navigator.language?.endsWith('US')) {
    return `${(km * 0.621371).toFixed(km < 16 ? 1 : 0)} mi`;
  }
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
