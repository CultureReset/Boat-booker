'use client';

import Link from 'next/link';
import { forwardRef, useId } from 'react';
import { sanitizeRichText } from '@/i18n/translate';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';

/**
 * Shared UI primitives.
 *
 * Every interactive surface in the product is built from these, so touch
 * targets, focus rings and disabled behaviour are consistent by construction
 * rather than by convention. Sizes assume a mobile-first layout: the default
 * control height is 44px, the minimum comfortable tap target.
 */

// --- Button ----------------------------------------------------------------

/**
 * `accent` is the guest app's primary action.
 *
 * The real product uses blue chrome with an orange call to action on the
 * customer side, and blue on both in the operator app — so "the primary
 * button" is not one colour, and the two need separate names rather than one
 * that means different things depending on where you are.
 */
type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  accent: 'bg-accent text-white hover:bg-accent-600 active:bg-accent-700 disabled:bg-accent-300',
  secondary: 'bg-ink text-white hover:bg-slate-800 active:bg-slate-900 disabled:bg-slate-400',
  outline: 'border border-line bg-white text-ink hover:bg-surface-sunken active:bg-slate-100 disabled:text-ink-faint',
  ghost: 'text-ink hover:bg-surface-sunken active:bg-slate-100 disabled:text-ink-faint',
  danger: 'bg-danger text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
}

export interface ButtonProps
  extends ButtonBaseProps,
    React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, loading, icon, iconRight, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      // A loading button stays focusable but rejects input, so a screen reader
      // user is not thrown out of the control mid-action.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center rounded-control font-semibold transition-colors',
        'disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 18 : 16} /> : icon ? <Icon name={icon} size={18} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={18} /> : null}
    </button>
  );
});

export interface LinkButtonProps
  extends ButtonBaseProps,
    Omit<React.ComponentProps<typeof Link>, 'className'> {
  className?: string;
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  fullWidth,
  icon,
  iconRight,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={cx(
        'inline-flex select-none items-center justify-center rounded-control font-semibold transition-colors',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={18} /> : null}
    </Link>
  );
}

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cx('animate-spin', className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// --- Form fields -----------------------------------------------------------

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
  className?: string;
}

/**
 * Wraps a control with its label, hint and error, and wires up the ARIA
 * relationships so the error is announced rather than only seen.
 */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-xs font-medium text-danger">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_BASE =
  'w-full rounded-control border bg-white px-3 text-ink transition-colors placeholder:text-ink-faint ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-faint';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx(CONTROL_BASE, 'h-11', invalid ? 'border-danger' : 'border-line', className)}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cx(CONTROL_BASE, 'py-2.5', invalid ? 'border-danger' : 'border-line', className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx(
          CONTROL_BASE,
          'h-11 appearance-none pr-9',
          invalid ? 'border-danger' : 'border-line',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevron-down"
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
});

export function Checkbox({
  label,
  description,
  count,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode;
  description?: string;
  count?: number;
}) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-start gap-3 rounded-control py-2 transition-colors hover:bg-surface-sunken',
        rest.disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-line text-brand-600 focus:ring-2 focus:ring-brand-500/40"
        {...rest}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-ink">{label}</span>
          {count !== undefined ? (
            <span className="text-xs tabular-nums text-ink-faint">{count}</span>
          ) : null}
        </span>
        {description ? <span className="mt-0.5 block text-xs text-ink-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function Radio({
  label,
  sublabel,
  count,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode;
  /** Second line explaining the option. Aligns to the top when present. */
  sublabel?: React.ReactNode;
  count?: number;
}) {
  return (
    <label
      className={cx(
        'flex cursor-pointer gap-3 rounded-control py-2 transition-colors hover:bg-surface-sunken',
        sublabel ? 'items-start' : 'items-center',
        className,
      )}
    >
      <input
        type="radio"
        className={cx(
          'h-5 w-5 shrink-0 cursor-pointer border-line text-brand-600 focus:ring-2 focus:ring-brand-500/40',
          Boolean(sublabel) && 'mt-0.5',
        )}
        {...rest}
      />
      <span className="flex flex-1 items-baseline justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-sm text-ink">{label}</span>
          {sublabel ? <span className="block text-xs text-ink-muted">{sublabel}</span> : null}
        </span>
        {count !== undefined ? <span className="text-xs tabular-nums text-ink-faint">{count}</span> : null}
      </span>
    </label>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cx('flex items-start justify-between gap-4 py-3', disabled && 'opacity-50')}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-ink-muted">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-slate-300',
          disabled && 'cursor-not-allowed',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

/** Plus/minus stepper used by every guest picker. */
export function Stepper({
  label,
  sublabel,
  value,
  min = 0,
  max = 99,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {sublabel ? <span className="block text-xs text-ink-muted">{sublabel}</span> : null}
      </span>
      <span className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-ink disabled:opacity-40 disabled:hover:border-line"
        >
          <Icon name="minus" size={16} />
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-ink disabled:opacity-40 disabled:hover:border-line"
        >
          <Icon name="plus" size={16} />
        </button>
      </span>
    </div>
  );
}

// --- Display ---------------------------------------------------------------

type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'gold' | 'dark';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-soft',
  brand: 'bg-brand-50 text-brand-800',
  success: 'bg-emerald-50 text-emerald-800',
  warning: 'bg-amber-50 text-amber-900',
  danger: 'bg-red-50 text-red-800',
  gold: 'bg-amber-100 text-amber-900',
  dark: 'bg-ink text-white',
};

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  icon?: IconName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        BADGE_TONES[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={12} strokeWidth={2.2} /> : null}
      {children}
    </span>
  );
}

/**
 * Star rating. Renders half stars by clipping a filled star over an empty one,
 * which stays crisp at any size without needing a second glyph.
 */
export function Stars({ rating, size = 14, className }: { rating: number; size?: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((position) => {
        const fill = Math.max(0, Math.min(1, rating - position + 1));
        return (
          <span key={position} className="relative inline-block" style={{ width: size, height: size }}>
            <Icon name="star-empty" size={size} className="absolute inset-0 text-slate-300" />
            {fill > 0 ? (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Icon name="star" size={size} className="text-gold" strokeWidth={0} />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

export function RatingSummary({
  rating,
  count,
  size = 'md',
  className,
}: {
  rating: number;
  count: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (count === 0) {
    return <span className={cx('text-xs text-ink-faint', className)}>No reviews yet</span>;
  }
  return (
    <span className={cx('inline-flex items-center gap-1.5', className)}>
      <Stars rating={rating} size={size === 'sm' ? 12 : 14} />
      <span className={cx('font-semibold tabular-nums', size === 'sm' ? 'text-xs' : 'text-sm')}>
        {rating.toFixed(1)}
      </span>
      <span className={cx('text-ink-muted', size === 'sm' ? 'text-xs' : 'text-sm')}>
        ({count})
      </span>
    </span>
  );
}

/**
 * Photo placeholder.
 *
 * Listings in this build carry deterministic gradients instead of bitmaps, so
 * every card renders instantly and works offline. Point `url` at a real image
 * and this becomes an ordinary `<img>` with the gradient as the loading state.
 */
export function PhotoFrame({
  photo,
  className,
  rounded = 'rounded-card',
  children,
}: {
  photo: { url?: string; placeholder: string; altText: string } | null;
  className?: string;
  rounded?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cx('relative overflow-hidden bg-slate-200', rounded, className)}
      style={photo ? { backgroundImage: photo.placeholder } : undefined}
      role="img"
      aria-label={photo?.altText ?? 'Boat photo'}
    >
      {photo?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.url} alt={photo.altText} className="h-full w-full object-cover" loading="lazy" />
      ) : null}
      {children}
    </div>
  );
}

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'section' | 'li';
}) {
  return (
    <Tag className={cx('rounded-card border border-line bg-white shadow-card', className)}>{children}</Tag>
  );
}

export function EmptyState({
  icon = 'info',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {body ? <p className="max-w-sm text-sm text-ink-muted">{body}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden="true" />;
}

export function SectionHeading({
  title,
  subtitle,
  action,
  level = 2,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  level?: 1 | 2 | 3;
  className?: string;
}) {
  const Tag = (`h${level}` as const);
  return (
    <div className={cx('mb-4 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <Tag
          className={cx(
            'font-bold tracking-tight text-ink',
            level === 1 ? 'text-2xl md:text-3xl' : level === 2 ? 'text-lg md:text-xl' : 'text-base',
          )}
        >
          {title}
        </Tag>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Renders catalog strings that intentionally contain `<b>`/`<a>` markup.
 *
 * The content is run through `sanitizeRichText` first, which strips everything
 * except a small tag whitelist and rejects any href that is not a relative
 * path, http(s), tel or mailto. That holds even if a string ever reaches this
 * component from user input rather than the catalog.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx('border-line', className)} />;
}
