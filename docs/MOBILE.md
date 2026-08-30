# Mobile

The mobile product is the same application, not a separate codebase. It ships
two ways: as an installable PWA, and as a native Android/iOS wrapper around the
same origin.

## Why one codebase

Every screen is built mobile-first and the layout is genuinely responsive, not
a desktop page squeezed down:

- A bottom tab bar (`components/shell/TabBar.tsx`) is the primary navigation
  below `md`; the header takes over above it. Tabs differ by role — an owner
  gets Calendar and Bookings where a guest gets Wishlist and Bookings.
- Pickers (destination, date, guests, filters) open as full bottom sheets on
  mobile and inline or as dialogs on desktop. One `Overlay` component does both.
- The listing page's booking panel is a sticky sidebar on desktop and a fixed
  bottom bar that expands into a sheet on mobile. The tab bar hides itself on
  those screens so two fixed bars never stack.
- Touch targets are 44px minimum; inputs are 16px on mobile so iOS Safari does
  not zoom on focus.
- `env(safe-area-inset-*)` is respected via the `safe-top` / `safe-bottom`
  utilities, so the notch and home indicator are handled inside the app shell.

## PWA

- **Manifest** — `app/manifest.webmanifest/route.ts`, generated from
  `config/brand` so a white-label build gets its own identity. Includes
  standalone display, portrait orientation, maskable icon and long-press
  shortcuts to Bookings, Inbox and Near Me.
- **Service worker** — `public/sw.js`. Registered by
  `components/shell/ServiceWorker.tsx` on `load`, and only in production.
  - Build assets (`/_next/static/`): cache-first — they are content-hashed.
  - Navigations: network-first with a cached fallback, then `/offline`.
  - `/api/*`: never cached. A stale price or a stale calendar would be worse
    than being offline, so live data always hits the network.
- **Offline state** — the worker serves `/offline`; the app also shows an
  inline banner on `online`/`offline` events.

Installing from Chrome on Android gives a standalone app with the tab bar,
splash screen and app icon. That is the fastest route to "the mobile app".

## Native wrapper (Capacitor)

`capacitor.config.json` is committed and configured. To produce an APK:

```bash
npm install --save-dev @capacitor/cli @capacitor/core @capacitor/android
npx cap add android

# Point the wrapper at a running server.
#   Emulator against local dev:  http://10.0.2.2:3000   (already the default)
#   Production:                  https://your-domain
# Edit `server.url` in capacitor.config.json, then:
npx cap sync android
npx cap open android      # builds in Android Studio
```

The wrapper loads the deployed application, so a release does not require an
app-store update unless native capabilities change.

### Native capabilities in use

| Capability | Web API | Native equivalent |
| --- | --- | --- |
| Location ("near me") | `navigator.geolocation` | `@capacitor/geolocation` |
| Share a listing | `navigator.share` | `@capacitor/share` |
| Add trip to calendar | `.ics` download | handled by the OS |
| Status bar / splash | manifest `theme_color` | `@capacitor/status-bar`, `@capacitor/splash-screen` |

The web APIs are used directly and degrade gracefully — `ShareButton` falls
back to copying the link where `navigator.share` is absent, and `NearMeButton`
reports a denied permission rather than failing silently. Swapping in the
Capacitor plugins is a change inside those two components.

## Testing on a device

```bash
npm run build && npm start          # service worker is production-only
# then open http://<your-lan-ip>:3000 from the phone
```

Chrome DevTools → Application → Manifest confirms installability; Lighthouse's
PWA audit covers the rest.
