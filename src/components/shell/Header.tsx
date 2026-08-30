'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { brand } from '@/config/brand';
import { currencies, languages } from '@/config/locale';
import { translate as t } from '@/i18n/translate';
import { useSession } from '@/components/providers/SessionProvider';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import { Badge } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import { AuthModal } from '@/components/auth/AuthModal';

/**
 * Site header.
 *
 * Two layouts from one component: a compact bar with a hamburger on mobile,
 * and a full navigation row from `md` up. The account menu is a dropdown on
 * desktop and a full-height sheet on mobile, matching the app.
 */

export function Header({ variant = 'default' }: { variant?: 'default' | 'transparent' }) {
  const pathname = usePathname();
  const { user, isOwner, unreadMessages, logout } = useSession();
  const { currency, language, setCurrency, setLanguage } = usePreferences();

  const [menuOpen, setMenuOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // A transparent header sits over the home hero and only gains its background
  // once the page scrolls, so the hero art is not cropped by a bar.
  useEffect(() => {
    if (variant !== 'transparent') return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant]);

  // Close the account dropdown on an outside click or Escape.
  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  // Any navigation dismisses whatever is open.
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  const solid = variant !== 'transparent' || scrolled;

  return (
    <>
      <header
        className={cx(
          'sticky top-0 z-40 transition-colors safe-top',
          solid ? 'border-b border-line bg-white' : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex h-14 max-w-shell items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2" aria-label={`${brand.name} home`}>
            <span
              className={cx(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                solid ? 'bg-brand-600 text-white' : 'bg-white/95 text-brand-700',
              )}
            >
              <Icon name="anchor" size={18} strokeWidth={2.2} />
            </span>
            <span className={cx('text-base font-extrabold tracking-tight', solid ? 'text-ink' : 'text-white')}>
              {brand.name}
            </span>
          </Link>

          <div className="flex-1" />

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            <HeaderLink href="/pages/whylist" solid={solid}>
              {t('navigation', 'getListed')}
            </HeaderLink>
            <HeaderLink href="/activity" solid={solid}>
              {t('navigation', 'activity')}
            </HeaderLink>
            <HeaderLink href="/boat-type" solid={solid}>
              {t('navigation', 'boatType')}
            </HeaderLink>
            <button
              type="button"
              onClick={() => setPrefsOpen(true)}
              className={cx(
                'flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-semibold transition-colors',
                solid ? 'text-ink hover:bg-surface-sunken' : 'text-white hover:bg-white/15',
              )}
            >
              <Icon name="globe" size={16} />
              {currency}
            </button>
          </nav>

          {user ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className={cx(
                  'flex h-10 items-center gap-2 rounded-full border py-1 pl-2 pr-1 transition-colors',
                  solid ? 'border-line bg-white hover:shadow-card' : 'border-white/40 bg-white/10 hover:bg-white/20',
                )}
              >
                <Icon name="menu" size={16} className={solid ? 'text-ink-soft' : 'text-white'} />
                <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {(user.firstName?.[0] ?? '?').toUpperCase()}
                  {unreadMessages > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-danger" />
                  ) : null}
                </span>
              </button>

              {accountOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-12 w-64 overflow-hidden rounded-card border border-line bg-white py-1 shadow-pop"
                >
                  <div className="border-b border-line px-4 py-3">
                    <p className="truncate text-sm font-semibold text-ink">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="truncate text-xs text-ink-muted">{user.email}</p>
                  </div>

                  {isOwner ? (
                    <MenuGroup>
                      <MenuItem href="/owner" icon="chart">{t('navigation', 'dashboard')}</MenuItem>
                      <MenuItem href="/owner/listings" icon="boat">{t('navigation', 'listings')}</MenuItem>
                      <MenuItem href="/owner/calendar" icon="calendar">{t('navigation', 'manageCalendar')}</MenuItem>
                      <MenuItem href="/owner/bookings" icon="tag">{t('navigation', 'bookings')}</MenuItem>
                      <MenuItem href="/owner/inbox" icon="message" badge={unreadMessages}>
                        {t('navigation', 'inbox')}
                      </MenuItem>
                      <MenuItem href="/owner/payouts" icon="wallet">{t('navigation', 'payouts')}</MenuItem>
                    </MenuGroup>
                  ) : (
                    <MenuGroup>
                      <MenuItem href="/account/bookings" icon="tag">{t('navigation', 'myBookings')}</MenuItem>
                      <MenuItem href="/account/inbox" icon="message" badge={unreadMessages}>
                        {t('navigation', 'inbox')}
                      </MenuItem>
                      <MenuItem href="/account/wishlist" icon="heart">{t('navigation', 'myWishlist')}</MenuItem>
                      <MenuItem href="/account/reviews" icon="star-empty">{t('navigation', 'myReviews')}</MenuItem>
                    </MenuGroup>
                  )}

                  <MenuGroup>
                    <MenuItem href={isOwner ? '/owner/settings' : '/account/profile'} icon="user">
                      {t('navigation', 'account')}
                    </MenuItem>
                    <MenuItem href="/help" icon="info">{t('navigation', 'helpCenter')}</MenuItem>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void logout()}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-sunken"
                    >
                      <Icon name="logout" size={16} className="text-ink-muted" />
                      {t('navigation', 'logout')}
                    </button>
                  </MenuGroup>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className={cx(
                  'hidden h-9 items-center rounded-control px-3 text-sm font-semibold transition-colors sm:flex',
                  solid ? 'text-ink hover:bg-surface-sunken' : 'text-white hover:bg-white/15',
                )}
              >
                {t('login', 'login')}
              </button>
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="flex h-9 items-center rounded-control bg-brand-600 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                {t('login', 'signup')}
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label={t('navigation', 'openMenu')}
                className={cx(
                  'flex h-9 w-9 items-center justify-center rounded-control transition-colors md:hidden',
                  solid ? 'text-ink hover:bg-surface-sunken' : 'text-white hover:bg-white/15',
                )}
              >
                <Icon name="menu" size={20} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile menu for signed-out visitors */}
      <Overlay open={menuOpen} onClose={() => setMenuOpen(false)} title={brand.name} size="full">
        <nav className="flex flex-col divide-y divide-line" aria-label="Mobile">
          <SheetLink href="/pages/whylist" icon="boat">{t('navigation', 'getListed')}</SheetLink>
          <SheetLink href="/deals" icon="tag">{t('deals', 'indexTitle')}</SheetLink>
          <SheetLink href="/catches" icon="camera">{t('catches', 'title')}</SheetLink>
          <SheetLink href="/activity" icon="grid">{t('navigation', 'activity')}</SheetLink>
          <SheetLink href="/boat-type" icon="boat">{t('navigation', 'boatType')}</SheetLink>
          <SheetLink href="/boating-near-me" icon="map-pin">{t('navigation', 'boatingNearMe')}</SheetLink>
          <SheetLink href="/sitemap" icon="list">{t('navigation', 'sitemap')}</SheetLink>
          <SheetLink href="/help" icon="info">{t('navigation', 'helpCenter')}</SheetLink>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setPrefsOpen(true);
            }}
            className="flex items-center gap-3 py-3.5 text-left text-sm font-medium text-ink"
          >
            <Icon name="globe" size={18} className="text-ink-muted" />
            {t('navigation', 'changeCurrency')} · {currency}
          </button>
        </nav>
      </Overlay>

      {/* Currency + language */}
      <Overlay open={prefsOpen} onClose={() => setPrefsOpen(false)} title={t('navigation', 'settings')} size="md">
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-bold text-ink">{t('navigation', 'selectYourLanguage')}</h3>
          <div className="grid grid-cols-2 gap-2">
            {languages.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setLanguage(item.code)}
                className={cx(
                  'flex h-11 items-center justify-between rounded-control border px-3 text-sm transition-colors',
                  language === item.code
                    ? 'border-brand-600 bg-brand-50 font-semibold text-brand-800'
                    : 'border-line hover:bg-surface-sunken',
                )}
              >
                {item.label}
                {language === item.code ? <Icon name="check" size={16} /> : null}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold text-ink">{t('navigation', 'selectYourCurrency')}</h3>
          <p className="mb-3 text-xs text-ink-muted">{t('navigation', 'currencyDescription')}</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {currencies.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setCurrency(item.code)}
                className={cx(
                  'flex h-10 items-center justify-between rounded-control px-3 text-sm transition-colors',
                  currency === item.code
                    ? 'bg-brand-50 font-semibold text-brand-800'
                    : 'hover:bg-surface-sunken',
                )}
              >
                <span className="truncate">{item.name}</span>
                <span className="ml-2 shrink-0 text-xs text-ink-muted">{item.symbol}</span>
              </button>
            ))}
          </div>
        </section>
      </Overlay>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}

function HeaderLink({
  href,
  solid,
  children,
}: {
  href: string;
  solid: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        'flex h-9 items-center rounded-control px-3 text-sm font-semibold transition-colors',
        solid ? 'text-ink hover:bg-surface-sunken' : 'text-white hover:bg-white/15',
      )}
    >
      {children}
    </Link>
  );
}

function MenuGroup({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-line py-1 last:border-0">{children}</div>;
}

function MenuItem({
  href,
  icon,
  badge,
  children,
}: {
  href: string;
  icon: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink transition-colors hover:bg-surface-sunken"
    >
      <Icon name={icon} size={16} className="text-ink-muted" />
      <span className="flex-1">{children}</span>
      {badge && badge > 0 ? <Badge tone="brand">{badge}</Badge> : null}
    </Link>
  );
}

function SheetLink({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3.5 text-sm font-medium text-ink">
      <Icon name={icon} size={18} className="text-ink-muted" />
      {children}
    </Link>
  );
}
