import { Header } from '@/components/shell/Header';

/**
 * Checkout shell.
 *
 * Deliberately stripped back — no footer, no tab bar, no cross-links. Once a
 * guest is on the payment screen the only two paths that matter are finishing
 * the booking and going back to the listing.
 */
export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="guest" className="flex min-h-dvh flex-col bg-surface-sunken">
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
