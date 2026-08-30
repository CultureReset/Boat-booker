# Android app map

What the real BoatBooker Android apps actually look like, and where this
rebuild diverges from them.

**Source and its limits.** Everything below is read off the Google Play store
listings — 11 screenshots plus store copy — captured 30 Aug 2026. That is the
only public, unauthenticated view of these apps. It gives real layout,
colour, terminology and navigation, but only for the screens the publisher
chose to show, and only above the fold. Nothing here comes from the APK or a
logged-in session. Screens marked **unmapped** were never shown.

**This document maps what the apps look like.**
[`PLATFORM-MAP.md`](PLATFORM-MAP.md) maps what the platform *does* — all 79
routes and 19,767 UI strings, including every screen never shown in a
screenshot. Read them together.

## The two apps

| | Package | Store name |
| --- | --- | --- |
| Guest | `com.boatbooker.customers` | BoatBooker |
| Operator | `com.boatbooker.captains` | BoatBooker for Owners |

This is a **two-app split**, not one app with a role switch. Our rebuild is a
single app with role-based routing (`/account/*` vs `/owner/*`), which is a
defensible web architecture but is not how the mobile product is packaged.

## Brand

| Token | Real app | This rebuild |
| --- | --- | --- |
| Header / chrome | Solid blue, white text | Blue, matches |
| **Primary CTA (guest app)** | **Orange** | Orange, matches |
| Primary CTA (owner app) | Blue | Blue, matches |
| Price | **Green**, bold | Green, matches |
| "Instant confirmation" | Green text + green check | Green text + check, matches |
| Scarcity | Red + flame glyph | Red line, shown from 3 bookings in 7 days |
| Guest logo | Leaf/wave mark, "Boat Booker" stacked | Anchor — diverges |
| Owner icon | Anchor with an F crossbar, blue gradient | Anchor — close |

The split is per-app, not global, so it is a `--cta` variable the shell sets:
the guest shells carry `data-app="guest"` and every `variant="primary"` follows
it. See `globals.css` and `components/ui/primitives.tsx`.

## Guest app

### Home
Blue hero. White search card floating over it containing destination
(magnifier), **Trip date** (calendar), guests (`2 adults • 2 children`), and a
full-width **orange Search** button. Below: an **"Explore nearby"** module —
an actual map with pins and a "View map" button — then "Exciting nearby…"
destinations.

> We have the search card and destination rails, but no map module on home —
> the schematic map lives on search, not home.

### Search results
- App bar: back chevron, destination as title (`Miami`), criteria as subtitle
  (`Sep 21 • 2 adults • 2 children`). **No persistent search widget.**
- White toolbar, three equal segments: **Filter · Sort · Map**.
- Result cards are **horizontal**: photo left (~40%, full-bleed), content
  right — title, `★ 4.8 (98)`, pin + location, green ✓ `Instant confirmation`,
  outline heart top-right, and `trips from` + **$450 in green bold** at the
  bottom right.
- Photos carrying video get a **blue circular play badge**.

> Matched: the phone card is horizontal, price green, instant confirmation a
> green check, and the award badges and spec row are hidden below `sm`. A cover
> carrying video shows the play badge and its length.

### Listing detail
App bar: back, truncated title, heart, share. Full-bleed hero photo. White
block with title and `★ 4.5 (76)`. **Google Maps** embed with a blue pin, then
an address row. Then a red scarcity line: 🔥 `Going fast! 6 bookings in the
past week`. Sections are white blocks separated by **grey gaps**, not
bordered cards.

> We use a schematic SVG map (no API key) and never surface scarcity, though
> `charterScarcity` exists in the API payload we extracted.

### Message thread
App bar: back + counterparty name. Below it a context bar: pale-green
**`CONFIRMED`** chip left, blue **`View details`** right. System events render
as full-width grey rows (`Booking accepted` · `13:59`). Messages are **not
bubbles** — circular avatar, bold name, plain body, timestamp, all
left-aligned for both parties. Attachments render inline (a shared map).
Composer is an outlined field with a blue circular send button.

## Owner app

### Bottom navigation — confirmed
**Home · Calendar · Bookings · Inbox · Menu**

Ours is Dashboard · Calendar · Bookings · Inbox · More. Same five slots, two
different labels.

### Bookings
App bar `Bookings`. Two Material tabs with counts: **`UPCOMING (2)` |
`ALL (19)`**. Each booking is a card: pale-green **`ACCEPTED`** strip as a
section header, then a guest row — circular avatar with an initial on a
coloured ground, `Kevin S.`, `3 adults • 0 children` — a divider, then a
`View details` row with date, `Center console boat 1 • 4 Hour Trip • US $900`
and a chevron.

> Ours has five tabs, inline status pills, and accept/decline buttons on the
> list row. The real app has two tabs, status as a section header, and pushes
> you into detail to act. Note the owner-side word is **ACCEPTED** where the
> guest side says **CONFIRMED**.

### Listings
Cards with a pale-green **`PUBLISHED`** header strip, a thumbnail + name +
**green shield check**, then an `Edit listing` row with the subtitle "Review or
make changes to your listing" and a chevron. A fixed bottom blue button:
**`Create another listing`**.

> Ours shows a completeness meter, view counts, booking counts, rating, boat
> type and capacity. The real screen is deliberately minimal.

### Calendar
The most divergent screen. A **contextual app bar** in selection mode:
`✕  1 date selected  ⚙`. Tabs: **`MONTH` | `DETAILS`**. Months scroll
**vertically and continuously** (June, then July below). The week starts on
**Sunday**. Day cells carry layered state: coloured dots beneath the number
(green / red / amber), background tints (pink, cream), a small dog-ear glyph
marking a note, and a black filled cell for the current selection. A floating
blue **`Edit ›`** button appears once dates are selected.

> Ours is a listing × day matrix with shift-click ranges — a desktop
> spreadsheet idiom. The real app is a single-listing scrolling month with a
> selection mode. Ours also starts the week on Monday.

### Message thread
Same context bar (`ACCEPTED` + `View details`), a bold `Today` divider and a
`Booking requested • 7:15 PM` system line. But unlike the guest app, messages
here **are bubbles** — thin outlined boxes with the avatar *outside*, incoming
left / outgoing right, timestamp bottom-left and a **`Delivered`** receipt
bottom-right. Above the composer sits an outlined **`Use Quick Replies`**
button — canned responses, an owner-only feature. The booking's special
requests appear as the first message, prefixed `Special requests:`.

## Divergence summary

Ranked by how visible each is to a user.

Rows 1–13 have been closed. Rows 14–16 remain, and why is given below.

| # | Real app | This rebuild | State |
| --- | --- | --- | --- |
| 1 | Orange primary CTA in the guest app | Orange, blue in the operator app | closed |
| 2 | Horizontal search cards, photo left | Horizontal on phones, vertical from `sm` | closed |
| 3 | Prices green; instant confirmation green text | Green price, green check | closed |
| 4 | Video on listings, play badge on cards | Play badge and clip length; player when a file exists | closed |
| 5 | Filter · Sort · Map three-up toolbar | Three-up sticky toolbar, sort in a sheet | closed |
| 6 | Red scarcity line on listings | Counted from real bookings, hidden below 3 | closed |
| 7 | Owner bookings: 2 tabs | 2 tabs | closed |
| 8 | Status as green section-header strip | Full-width header strip | closed |
| 9 | Owner calendar: scrolling month, selection mode, Sunday start | Same, with a contextual app bar | closed |
| 10 | Quick Replies, delivery receipts, avatars, system rows in threads | All four | closed |
| 11 | Minimal owner listings screen | Minimal on phones, detail from `sm` | closed |
| 12 | Guest shown as `Kevin S.` | `Kevin S.` | closed |
| 13 | Bottom tab bar is the only navigation on a phone | Sidebar is desktop-only; Menu/Profile tabs carry the rest | closed |
| 14 | Real Google Maps | Schematic SVG map | **open** — a map key cannot be committed, and tiles would not load offline |
| 15 | Real photography and video | Deterministic gradients, poster + play badge | **open** — no media to serve; the model carries the fields a deployment would fill |
| 16 | Two separate apps | One app, role-routed | **open** — a deliberate web architecture, not an oversight |

## Still unmapped visually

Never shown in any store asset, so their **layout** is still inferred:

- **Owner Home** — the dashboard itself, the screen most directly asked about
- **Owner Menu** tab contents
- **Guest bottom navigation** (only the owner app's was shown)
- Booking and checkout flow
- Account, profile, payment methods, payouts, team, verification
- Everything below the fold on every screen above

**What every one of these screens does is now mapped.** See
[`PLATFORM-MAP.md`](PLATFORM-MAP.md) — 79 routes and 19,767 UI strings across
103 domains, pulled from the production build manifest and translations API.
That covers fields, steps, states, validation rules and copy for all of the
above; it does not cover where anything sits on screen.

Closing the remaining visual gap needs either a logged-in session or the APK.
