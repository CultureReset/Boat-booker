# BoatBooker — full-stack rebuild

A working rebuild of the BoatBooker boat-tour marketplace: the public site, the
customer account, the operator dashboard, the REST backend behind them, and a
mobile app shell — one codebase, no hardcoded screens.

Everything is real. Search actually filters and ranks, prices are computed by a
pricing engine, availability is enforced against a calendar, bookings move
through a state machine, and the operator side writes to the same data the
guest side reads.

```bash
npm install
npm run dev          # http://localhost:3000
```

Sign in with either seeded account — password `Password123`:

| Account | Email | What it shows |
| --- | --- | --- |
| Customer | `guest@boatbooker.demo` | Bookings across every state, inbox, wishlist, reviews, loyalty, credit |
| Operator | `owner@boatbooker.demo` | A published listing, live bookings, calendar, payouts, team |

## What is here

**Public** — home, faceted search with map, listing detail, destination pages,
activity and boat-type indexes, country/state/location indexes, human sitemap,
help centre, blog, and every policy page.

**Booking** — trip selection, live availability, server-computed quote,
checkout with payment split, instant-book vs request, confirmation with an
`.ics` download.

**Customer** — bookings (with cancellation and refund maths), inbox, wishlist,
reviews, payment methods, profile, notifications, loyalty, referrals, settings.

**Operator** — dashboard with an attention queue, booking accept/decline,
multicalendar with bulk date editing, a seven-step listing editor, trips and
pricing, photos, reviews with public responses, payout ledger, payout methods,
team, verification, embeddable widgets, opportunities, business settings.

**Backend** — 25 REST endpoints, session auth, magic links, password reset, and
the services that enforce all of it.

## Verifying it works

```bash
npm run verify       # typecheck + i18n key check + production build
npm start            # then, in another shell:
npm run smoke        # 59 end-to-end API assertions
```

`npm run smoke` drives the API the way the UI does — search, quote, book,
double-book (must fail), owner accept, message, cancel, and back — and asserts
the authorisation boundaries hold at each step.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the layers fit together
  and where to change things
- [`docs/API.md`](docs/API.md) — every endpoint, with request and response
  shapes
- [`docs/MOBILE.md`](docs/MOBILE.md) — PWA, responsive strategy, Capacitor
  packaging

## Modularity

Nothing user-facing is hardcoded. Four files drive the product:

| File | Controls |
| --- | --- |
| `src/config/brand.ts` | Name, contact, fees, deposit, loyalty tiers, referral credit |
| `src/config/taxonomy.ts` | Activities, boat types, amenities, payment methods, durations, badges |
| `src/config/locale.ts` | 36 currencies, languages, unit systems |
| `src/i18n/catalog.ts` | Every string in the product, in 20 domains |

Adding an amenity to `taxonomy.ts` makes it appear in the listing editor, the
listing page, the search filters and the seed generator — with no component
change. Swapping `brand.ts` rebrands the whole platform including the PWA
manifest.

Storage is behind a `StorageAdapter` interface (`src/lib/storage/adapter.ts`);
the shipped adapter snapshots JSON to disk, and pointing this at Postgres or
Supabase means writing one class.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind 3.
No runtime dependencies beyond the framework — auth, pricing, search and
storage are all first-party code.

## Notes on this build

Three things are stubbed, each behind a seam that makes them swappable:

- **Photos** are deterministic CSS gradients rather than uploaded bitmaps, so
  the demo works offline and needs no asset host. `Photo.url` is already in the
  model and `PhotoFrame` renders it when present.
- **Email** is not sent. Magic-link and password-reset tokens are returned in
  the API response and surfaced in the UI, gated behind
  `AUTH_EXPOSE_MAGIC_LINK` — which **must** be `false` in production, or anyone
  could request a link for any address and read it from the response.
- **Payments** validate the card (Luhn, expiry) and store only the brand and
  last four digits. No charge is made; the money movement is modelled in the
  payout ledger.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | dev-only random | **Required in production.** Signs session cookies |
| `AUTH_EXPOSE_MAGIC_LINK` | `true` | Set `false` in production once email is wired |
| `STORAGE_DRIVER` | `json-file` | `memory` for ephemeral runs |
| `STORAGE_FILE` | `.data/boatbooker.json` | Snapshot location |
| `SEED_VALUE` | `20260830` | Change for a different but still reproducible dataset |
| `NEXT_PUBLIC_BRAND_*` | see `config/brand.ts` | White-label overrides |
