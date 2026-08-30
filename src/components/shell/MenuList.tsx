import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/primitives';

/**
 * The Android menu-screen idiom: grouped lists of single-line rows, each with a
 * leading icon and a trailing chevron.
 *
 * Both apps use it — the operator app's Menu tab and the customer app's Profile
 * tab — so it lives here rather than in either one. Groups carry a caption
 * because the row list is long enough that a flat list stops being scannable.
 */

export interface MenuRow {
  href: string;
  label: string;
  icon: IconName;
  /** Secondary line under the label, for rows whose purpose isn't obvious. */
  hint?: string;
  /** Right-aligned value — a balance, a count, a current setting. */
  value?: string;
  /** Right-aligned pill; use for things needing attention, not for counts. */
  badge?: string;
}

export interface MenuGroup {
  title: string;
  rows: MenuRow[];
}

export function MenuList({ groups }: { groups: MenuGroup[] }) {
  return (
    <>
      {groups.map((group) => (
        <section key={group.title} className="mb-4">
          <h2 className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {group.title}
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
            {group.rows.map((row) => (
              <li key={`${group.title}-${row.href}-${row.label}`}>
                <Link
                  href={row.href}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-surface-sunken"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-soft">
                    <Icon name={row.icon} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{row.label}</span>
                    {row.hint ? (
                      <span className="block truncate text-xs text-ink-muted">{row.hint}</span>
                    ) : null}
                  </span>
                  {row.badge ? <Badge tone="brand">{row.badge}</Badge> : null}
                  {row.value ? (
                    <span className="shrink-0 text-xs font-semibold text-ink-muted">{row.value}</span>
                  ) : null}
                  <Icon name="chevron-right" size={16} className="shrink-0 text-ink-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
