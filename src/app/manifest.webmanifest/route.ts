import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';

/**
 * Web app manifest.
 *
 * Generated rather than static so a white-label deployment picks up its own
 * name and colours from `config/brand` with no extra build step. Together with
 * the service worker this makes the site installable on Android and iOS, which
 * is what the "mobile app" is here.
 */
export function GET() {
  const manifest = {
    id: '/',
    name: brand.name,
    short_name: brand.name,
    description: t('homepage', 'metaDescription'),
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#1d70f1',
    categories: ['travel', 'lifestyle'],
    lang: 'en',
    dir: 'ltr',
    icons: [
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    // Long-press shortcuts on the installed app icon.
    shortcuts: [
      {
        name: t('navigation', 'myBookings'),
        url: '/account/bookings',
        icons: [{ src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' }],
      },
      {
        name: t('navigation', 'inbox'),
        url: '/account/inbox',
        icons: [{ src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' }],
      },
      {
        name: t('navigation', 'boatingNearMe'),
        url: '/boating-near-me',
        icons: [{ src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' }],
      },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'content-type': 'application/manifest+json',
      'cache-control': 'public, max-age=3600',
    },
  });
}
