'use client';

import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { cx } from './cx';

/**
 * Modal and bottom-sheet overlays.
 *
 * One implementation serves both: on mobile it slides up from the bottom edge
 * (the pattern the native app uses for filters, pickers and confirmations); on
 * desktop it centres as a dialog. Focus is trapped while open, Escape closes,
 * and the page behind is locked from scrolling.
 */

function useFocusTrap(active: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    // Lock the page behind the overlay without losing the scroll position.
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const focusable = () =>
      Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Move focus into the dialog so the next Tab stays inside it.
    const first = focusable()[0] ?? containerRef.current;
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (!items.length) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      // Return focus to whatever opened the dialog.
      restoreRef.current?.focus?.();
    };
  }, [active, onClose]);

  return containerRef;
}

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** `sheet` slides from the bottom on mobile; `dialog` always centres. */
  variant?: 'sheet' | 'dialog';
  size?: 'sm' | 'md' | 'lg' | 'full';
  /** Sticky footer, typically the primary action. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Hides the default header when the content supplies its own. */
  hideHeader?: boolean;
}

const SIZES = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-lg',
  lg: 'md:max-w-2xl',
  full: 'md:max-w-4xl',
};

export function Overlay({
  open,
  onClose,
  title,
  variant = 'sheet',
  size = 'md',
  footer,
  children,
  hideHeader,
}: OverlayProps) {
  const handleClose = useCallback(() => onClose(), [onClose]);
  const containerRef = useFocusTrap(open, handleClose);

  // Portals need the DOM, so nothing renders during SSR or before mount.
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col bg-white shadow-pop outline-none',
          variant === 'sheet'
            ? 'rounded-t-2xl md:rounded-card'
            : 'mx-4 rounded-card',
          size === 'full' && variant === 'sheet' ? 'h-[92dvh]' : '',
          SIZES[size],
        )}
      >
        {!hideHeader ? (
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-4 py-3">
            <h2 className="text-base font-bold text-ink">{title}</h2>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <Icon name="close" size={20} />
            </button>
          </header>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>

        {footer ? (
          <footer className="shrink-0 border-t border-line px-4 py-3 safe-bottom">{footer}</footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmation dialog for destructive actions (cancel a booking, delete a
 * listing). Kept separate so the copy and the danger styling are consistent
 * everywhere one is needed.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = true,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Overlay open={open} onClose={onClose} title={title} variant="dialog" size="sm">
      {body ? <div className="text-sm text-ink-soft">{body}</div> : null}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-control border border-line px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken sm:px-5"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={cx(
            'h-11 rounded-control px-4 text-sm font-semibold text-white transition-colors disabled:opacity-60 sm:px-5',
            destructive ? 'bg-danger hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700',
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}
