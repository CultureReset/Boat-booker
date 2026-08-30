import { Footer } from '@/components/shell/Footer';
import { Header } from '@/components/shell/Header';
import { TabBar, TabBarSpacer } from '@/components/shell/TabBar';

/**
 * Public site shell.
 *
 * Wraps every page a signed-out visitor can reach: home, search, listings,
 * taxonomy indexes and the static pages. Account and owner areas have their
 * own layouts with sidebar navigation instead.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
      <TabBarSpacer />
      <TabBar />
    </div>
  );
}
