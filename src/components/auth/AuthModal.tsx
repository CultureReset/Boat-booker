'use client';

import { Overlay } from '@/components/ui/Overlay';
import { AuthForm, type AccountType, type AuthStep } from './AuthForm';
import type { PublicUser } from '@/lib/auth/session';

/**
 * Auth in a sheet.
 *
 * Signing in is almost always an interruption to something else — booking,
 * saving a listing, opening the inbox — so the default is a modal that keeps
 * the user where they were rather than a full page navigation. `/login` uses
 * the same form on a page for direct links and redirects.
 */
export function AuthModal({
  open,
  onClose,
  initialStep,
  initialAccountType,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  initialStep?: AuthStep;
  initialAccountType?: AccountType;
  onSuccess?: (user: PublicUser) => void;
}) {
  return (
    <Overlay open={open} onClose={onClose} title="" hideHeader size="md">
      <div className="relative pb-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -right-1 -top-1 flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="pt-6">
          <AuthForm
            compact
            initialStep={initialStep}
            initialAccountType={initialAccountType}
            onSuccess={(user) => {
              onSuccess?.(user);
              onClose();
            }}
          />
        </div>
      </div>
    </Overlay>
  );
}
