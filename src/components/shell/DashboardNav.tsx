'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Dashboard navigation — the desktop sidebar rail.
 *
 * Deliberately absent on mobile. It used to render there as a horizontally
 * scrolling chip row, which put a second copy of Bookings / Inbox / Calendar
 * directly above a bottom tab bar that already had them: two navigations
 * competing for the same taps, and a wasted 60px on every screen.
 *
 * On mobile the split is the app's: the tab bar carries the five working
 * destinations, and everything else hangs off the Menu screen (`/owner/menu`,
 * `/account/menu`). Anything added here must also appear in one of those two,
 * or it becomes unreachable on a phone.
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
  );
}
