import type { Metadata, Viewport } from 'next';
import { brand } from '@/config/brand';
import { translate } from '@/i18n/translate';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { PreferencesProvider } from '@/components/providers/PreferencesProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { ServiceWorker } from '@/components/shell/ServiceWorker';
import { currentUser, publicUser } from '@/lib/auth/session';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: translate('homepage', 'metaTitle'),
    template: `%s | ${brand.name}`,
  },
  description: translate('homepage', 'metaDescription'),
  applicationName: brand.name,
  manifest: '/manifest.webmanifest',
  // Declared explicitly so browsers stop probing for /favicon.ico, which this
  // build does not ship — the mark is an SVG that scales to every size.
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon-192.svg' }],
    shortcut: ['/favicon.svg'],
  },
  appleWebApp: {
    capable: true,
    title: brand.name,
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: brand.name,
    title: translate('homepage', 'metaTitle'),
    description: translate('homepage', 'metaDescription'),
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The shell is a fixed app frame on mobile; zooming it breaks the layout,
  // but pinch-zoom stays available up to 5x so the page remains accessible.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The session is resolved on the server so the first paint already knows who
  // the visitor is — no logged-out flash on the header or the wishlist hearts.
  const user = await currentUser();

  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-white focus:px-4 focus:py-2 focus:shadow-pop"
        >
          {translate('navigation', 'skipToContent')}
        </a>
        <PreferencesProvider
          initialCurrency={user?.currency ?? 'USD'}
          initialLanguage={user?.language ?? 'en'}
        >
          <SessionProvider initialUser={user ? publicUser(user) : null}>
            <ToastProvider>
              <ServiceWorker />
              {children}
            </ToastProvider>
          </SessionProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
