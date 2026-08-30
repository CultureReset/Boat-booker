'use client';

import { useEffect, useRef, useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import { PhotoFrame } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Listing photo gallery.
 *
 * Mobile gets a swipeable, snap-scrolling strip with a position counter — the
 * pattern every travel app uses, and the one that works without a mouse.
 * Desktop gets a hero-plus-grid mosaic. Both open the same full-screen viewer,
 * which supports arrow keys and reports position to assistive tech.
 */

export interface GalleryPhoto {
  id: string;
  url?: string;
  placeholder: string;
  altText: string;
  /** Set when the asset is a clip; `url` above is then its poster frame. */
  video?: { url?: string; durationSeconds: number };
}

export function Gallery({ photos, title }: { photos: GalleryPhoto[]; title: string }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  // Track which photo is centred in the mobile strip so the counter is honest.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const onScroll = () => {
      const index = Math.round(strip.scrollLeft / strip.clientWidth);
      setCurrent(Math.max(0, Math.min(photos.length - 1, index)));
    };

    strip.addEventListener('scroll', onScroll, { passive: true });
    return () => strip.removeEventListener('scroll', onScroll);
  }, [photos.length]);

  if (!photos.length) {
    return <div className="aspect-[4/3] w-full rounded-card bg-slate-200 md:aspect-[21/9]" aria-hidden="true" />;
  }

  const [hero, ...rest] = photos;

  return (
    <>
      {/* ------------------------------------------------------- mobile */}
      <div className="relative md:hidden">
        <div
          ref={stripRef}
          className="flex snap-x snap-mandatory overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
          role="group"
          aria-label={t('viewCharter', 'photoCount', { count: photos.length, p: photos.length })}
        >
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setViewerIndex(index)}
              className="w-full shrink-0 snap-start"
              aria-label={`${photo.altText} — ${index + 1} of ${photos.length}`}
            >
              <PhotoFrame photo={photo} rounded="rounded-none" className="aspect-[4/3] w-full" />
            </button>
          ))}
        </div>

        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-white">
          {current + 1} / {photos.length}
        </span>
      </div>

      {/* ------------------------------------------------------ desktop */}
      <div className="hidden md:block">
        <div className="relative grid h-[380px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-card">
          <button
            type="button"
            onClick={() => setViewerIndex(0)}
            className="col-span-2 row-span-2"
            aria-label={hero.altText}
          >
            <PhotoFrame photo={hero} rounded="rounded-none" className="h-full w-full" />
          </button>

          {rest.slice(0, 4).map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setViewerIndex(index + 1)}
              aria-label={photo.altText}
            >
              <PhotoFrame photo={photo} rounded="rounded-none" className="h-full w-full" />
            </button>
          ))}

          <button
            type="button"
            onClick={() => setViewerIndex(0)}
            className="absolute bottom-3 right-3 flex h-10 items-center gap-2 rounded-control bg-white px-3.5 text-sm font-semibold text-ink shadow-card transition-transform hover:scale-[1.02]"
          >
            <Icon name="grid" size={16} />
            {t('viewCharter', 'showAllPhotos', { count: photos.length })}
          </button>
        </div>
      </div>

      <PhotoViewer
        photos={photos}
        title={title}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onIndexChange={setViewerIndex}
      />
    </>
  );
}

function PhotoViewer({
  photos,
  title,
  index,
  onClose,
  onIndexChange,
}: {
  photos: GalleryPhoto[];
  title: string;
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  // Arrow keys page through the viewer; Escape is handled by the Overlay.
  useEffect(() => {
    if (index === null) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') onIndexChange((index + 1) % photos.length);
      if (event.key === 'ArrowLeft') onIndexChange((index - 1 + photos.length) % photos.length);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onIndexChange]);

  if (index === null) return null;
  const photo = photos[index];

  return (
    <Overlay open onClose={onClose} title={title} size="full" variant="dialog">
      <div className="flex flex-col gap-3">
        {/* A clip with a file plays here; one without falls back to its
            poster and badge, the same way a still without a bitmap falls back
            to its gradient. */}
        {photo.video?.url ? (
          <video
            key={photo.id}
            src={photo.video.url}
            poster={photo.url || undefined}
            controls
            playsInline
            className="aspect-[4/3] w-full rounded-card bg-black object-cover"
          />
        ) : (
          <PhotoFrame photo={photo} className="aspect-[4/3] w-full" />
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onIndexChange((index - 1 + photos.length) % photos.length)}
            aria-label={t('listingCard', 'previousImage')}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-surface-sunken"
          >
            <Icon name="chevron-left" size={20} />
          </button>

          <span className="text-sm font-semibold tabular-nums text-ink" aria-live="polite">
            {index + 1} / {photos.length}
          </span>

          <button
            type="button"
            onClick={() => onIndexChange((index + 1) % photos.length)}
            aria-label={t('listingCard', 'nextImage')}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-surface-sunken"
          >
            <Icon name="chevron-right" size={20} />
          </button>
        </div>

        {photo.altText ? <p className="text-sm text-ink-muted">{photo.altText}</p> : null}

        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {photos.map((thumb, thumbIndex) => (
            <button
              key={thumb.id}
              type="button"
              onClick={() => onIndexChange(thumbIndex)}
              aria-label={`${t('general', 'select')} ${thumbIndex + 1}`}
              aria-current={thumbIndex === index || undefined}
              className={cx(
                'shrink-0 overflow-hidden rounded transition-opacity',
                thumbIndex === index ? 'ring-2 ring-brand-600' : 'opacity-60 hover:opacity-100',
              )}
            >
              <PhotoFrame photo={thumb} rounded="rounded" badgeSize="sm" className="h-14 w-20" />
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  );
}
