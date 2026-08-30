'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Dashboard navigation.
 *
 * A vertical rail on desktop, and a horizontally scrolling chip row on mobile
 * where a sidebar would eat half the screen. The same item list feeds both, so
 * the two can never drift apart. The bottom tab bar handles the top-level
 * jumps on mobile; this handles movement within a section.
 */

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
  /** Prefix used for the active check; defaults to `href`. */
  match?: string;
  /** Renders a visual separator above this item on desktop. */
  groupStart?: boolean;
}

export function DashboardNav({ items, title }: { items: DashboardNavItem[]; title: string }) {
  const pathname = usePathname();

  const isActive = (item: DashboardNavItem) => {
    const target = item.match ?? item.href;
    // An exact match for the section root, prefix match for everything deeper,
    // so /account/bookings/123 still highlights "Bookings".
    return pathname === target || (target !== '/account' && target !== '/owner' && pathname.startsWith(`${target}/`));
  };

  return (
    <>
      {/* --------------------------------------------------- desktop */}
      <nav aria-label={title} className="hidden w-56 shrink-0 md:block">
        <div className="sticky top-20">
          <h2 className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-ink-faint">{title}</h2>
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.href} className={item.groupStart ? 'mt-3 border-t border-line pt-3' : undefined}>
                <Link
                  href={item.href}
                  aria-current={isActive(item) ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm transition-colors',
                    isActive(item)
                      ? 'bg-brand-50 font-bold text-brand-800'
                      : 'font-medium text-ink-soft hover:bg-surface-sunken hover:text-ink',
                  )}
                >
                  <Icon name={item.icon} size={17} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && item.badge > 0 ? <Badge tone="brand">{item.badge}</Badge> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* ---------------------------------------------------- mobile */}
      <nav aria-label={title} className="-mx-4 mb-4 md:hidden">
        <ul className="rail px-4">
          {items.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={isActive(item) ? 'page' : undefined}
                className={cx(
                  'flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors',
                  isActive(item)
                    ? 'bg-ink font-bold text-white'
                    : 'border border-line bg-white font-medium text-ink-soft',
                )}
              >
                <Icon name={item.icon} size={15} />
                {item.label}
                {item.badge && item.badge > 0 ? (
                  <span
                    className={cx(
                      'ml-0.5 rounded-full px-1.5 text-[10px] font-bold',
                      isActive(item) ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-800',
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
