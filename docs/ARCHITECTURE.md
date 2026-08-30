# Architecture

## The shape of it

```
  Browser / PWA / Capacitor shell
            │
  ┌─────────┴──────────────────────────────────────────┐
  │  app/          routes — server components by default │
  │  components/   UI — 'use client' only where needed   │
  └─────────┬──────────────────────────────────────────┘
            │
  ┌─────────┴──────────┐        ┌──────────────────────┐
  │  app/api/*         │        │  server components    │
  │  route handlers    │        │  call services direct │
  └─────────┬──────────┘        └──────────┬───────────┘
            │                              │
            └──────────┬───────────────────┘
                       │
  ┌────────────────────┴─────────────────────────────────┐
  │  lib/services/   pricing · availability · bookings ·   │
  │                  search · messages · reviews ·         │
  │                  accounts · owner · charters           │
  └────────────────────┬─────────────────────────────────┘
                       │
  ┌────────────────────┴─────────────────────────────────┐
  │  lib/storage/    StorageAdapter (json-file | memory)   │
  └───────────────────────────────────────────────────────┘
                       ▲
  config/ · i18n/ · content/ — data that drives everything
```

The important property: **a server component and a route handler call the same
service**. There is no logic in a route handler that the page could not reach,
and none in a page the API could not reach. That is why the smoke test can
assert correctness through the API and be confident the UI agrees.

## Layers

### `config/` — the product as data

| File | Owns |
| --- | --- |
| `brand.ts` | Identity, support contacts, service fee, deposit rate, loyalty tiers, referral credit, response window |
| `taxonomy.ts` | 23 activities, 30 boat types, 54 amenities, payment methods, duration buckets, departure windows, verification badges, engine/fuel vocabularies, review criteria |
| `locale.ts` | 36 currencies with rates and formatting rules, languages, imperial/metric |

These are consumed by the seed generator, the search facets, the listing
editor, the listing page and the SEO index pages. One definition, many
surfaces. Adding an amenity is a one-line change that shows up in all of them.

### `i18n/` — every user-facing string

`catalog.ts` holds ~700 strings across 20 domains (`navigation`, `search`,
`viewCharter`, `booking`, `owner`, …). `translate.ts` resolves them, handling:

- **Placeholders** — `%name%`, with `%brand%` and `%year%` always available.
- **Plurals** — `{0}No boats|{1}%p% boat|[2,Inf]%p% boats`, selected by `count`.
- **Safe rich text** — `sanitizeRichText` allows `<b> <strong> <em> <i> <br>
  <a>` and rejects any href that is not relative, http(s), `tel:` or `mailto:`.
  Everything rendered through `RichText` goes through it.

A missing key returns `domain.key` rather than throwing, so a typo is visible
but never takes a page down. `npm run check:i18n` scans every call site against
the catalog and fails CI on a missing key.

### `lib/core/` — primitives

`money.ts` (conversion, formatting, currency-aware rounding), `dates.ts`
(timezone-free trip dates, weekday bitmasks, calendar grids), `ids.ts`
(`mulberry32` seeded RNG, booking references, slugs).

Trip dates are deliberately plain `YYYY-MM-DD` strings with no timezone — a
trip on the 4th is on the 4th wherever you are browsing from. Timestamps
(created, confirmed) are full ISO UTC.

### `lib/services/` — the business rules

**`pricing.ts`** — one function computes every price the platform quotes. The
order is fixed: base → additional guests → multi-day → discounts → service fee
→ card processing → split into due-now / due-on-arrival. Search cards, the
listing panel, checkout, the booking record and the payout ledger all call it,
so a quote can never disagree with what is charged.

**`availability.ts`** — a trip is bookable when the date is future, the package
runs that weekday and season, the owner has not blocked it, the boat is not
already booked, and the group fits. Every surface that asks "can I book this?"
resolves through here, so search, the listing page and checkout cannot
disagree.

**`bookings.ts`** — the lifecycle:

```
pending ──accept──▶ confirmed ──trip date passes──▶ completed
   │                    │
   ├──decline──▶ declined   └──cancel──▶ cancelled
   └──window elapses──▶ expired
```

Every transition that frees a date releases the calendar block; every one that
takes a date reserves it. A *pending* request holds the date too — otherwise an
owner could accept a request for a day sold underneath them.

**`search.ts`** — parse → filter → sort → page → facet. Facet counts use the
"all filters except this one" rule, which is what stops a user ticking a box,
getting zero results, and having no way back. The default ranking is
transparent: rating, review volume (log-damped), instant book, cancellation
window, award, verification, demand, proximity, photo count. No paid placement.

**`owner.ts`** — listings, trips, photos, calendar, payouts, team,
verification. Every function takes the acting owner's ID and verifies ownership
before touching a record, so authorisation cannot be skipped by calling a
service directly.

### `lib/storage/` — swappable persistence

```ts
interface StorageAdapter {
  load(): Promise<Database>;
  persist(db: Database): Promise<void>;
  readonly name: string;
}
```

`JsonFileAdapter` debounces writes and renames a temp file into place, so a
reader never sees a half-written snapshot. `MemoryAdapter` is for tests.
Pointing at Postgres means writing one more class and changing the factory in
`storage/index.ts` — no service or route handler imports a concrete adapter.

`mutate()` applies a change synchronously inside its callback, so two
concurrent requests cannot observe a torn intermediate state within a tick.
That is what makes the double-booking guard in `reserveDates` correct.

## Security

| Concern | How |
| --- | --- |
| Passwords | PBKDF2-SHA512, 120k iterations, per-user salt, constant-time compare, rehash-on-login when the work factor rises |
| Sessions | Random opaque token, HMAC-signed HttpOnly cookie, server-side record so it can be revoked |
| Account enumeration | Login returns one message for both failure modes; password reset always reports success |
| Brute force | Fixed-window rate limits on login (10/min), signup, magic link and reset (5/min) |
| Card data | Luhn + expiry validated, then the PAN is discarded — only brand and last four are stored |
| Payout accounts | Same: last four characters only |
| Authorisation | Checked in the service layer, not the route handler, so it holds on every path |
| Address disclosure | The exact meeting point is released only to the owner or a guest holding a confirmed booking |
| XSS | Catalog rich text passes through a tag whitelist and href scheme check |
| Price tampering | The server recomputes the quote on submit and ignores the client's number |

## Rendering

Server components by default. `'use client'` only where there is genuine
interactivity: the search results (URL-driven filtering), the booking panel
(live quoting), pickers, the listing editor, the multicalendar and the
providers.

The listing page ships its gallery, specs, amenities and first page of reviews
in the initial HTML — indexable and readable before any JavaScript runs.

One boundary rule worth knowing: **a plain function exported from a `'use
client'` module cannot be called during a server render.** That is why `cx`
lives in its own directive-free module (`components/ui/cx.ts`) rather than
being re-exported from `primitives.tsx`.

## Where to change things

| I want to… | Change |
| --- | --- |
| Rebrand | `config/brand.ts` + colours in `tailwind.config.ts` |
| Add an amenity or activity | `config/taxonomy.ts` — appears everywhere |
| Change the fee or deposit | `commerceConfig` in `config/brand.ts` |
| Reword anything | `i18n/catalog.ts` |
| Change the ranking | `recommendationScore` in `lib/services/search.ts` |
| Change price maths | `computeBreakdown` in `lib/services/pricing.ts` |
| Move to a real database | New `StorageAdapter`, wire it in `storage/index.ts` |
| Add a static page | Append to `content/pages.ts` |
| Add a currency | `config/locale.ts` |
