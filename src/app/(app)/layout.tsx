import { Header } from '@/components/shell/Header';
import { TabBar, TabBarSpacer } from '@/components/shell/TabBar';

/**
 * Shell for app screens that belong to neither dashboard.
 *
 * Catches, trip memories, public profiles and shared wishlists are ordinary
 * screens a person navigates to and back out of, but they sit outside
 * `/account` and `/owner` because they are not scoped to one role — a shared
 * wishlist opens from a link, a public profile is public. Without a layout they
 * rendered with no header and no tab bar at all, which on a phone is a screen
 * with no way out.
 *
 * No footer, unlike the marketing shell: these are reached from inside the app,
 * where the bottom tab bar is the navigation and a sitemap column below the
 * content is chrome from a different context.
 *
 * The route group means none of this changes a URL.
 */
export default function AppScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="guest" className="flex min-h-dvh flex-col">
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <TabBarSpacer />
      <TabBar />
    </div>
  );
}
