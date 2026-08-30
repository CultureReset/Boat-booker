# Android app map

What the real BoatBooker Android apps actually look like, and where this
rebuild diverges from them.

**Source and its limits.** Everything below is read off the Google Play store
listings — 11 screenshots plus store copy — captured 30 Aug 2026. That is the
only public, unauthenticated view of these apps. It gives real layout,
colour, terminology and navigation, but only for the screens the publisher
chose to show, and only above the fold. Nothing here comes from the APK or a
logged-in session. Screens marked **unmapped** were never shown.

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
| **Primary CTA (guest app)** | **Orange** | Blue — **diverges** |
| Primary CTA (owner app) | Blue | Blue, matches |
| Price | **Green**, bold | Ink — diverges |
| "Instant confirmation" | Green text + green check | Blue badge — diverges |
| Scarcity | Red + flame glyph | Not surfaced |
| Guest logo | Leaf/wave mark, "Boat Booker" stacked | Anchor — diverges |
| Owner icon | Anchor with an F crossbar, blue gradient | Anchor — close |

The orange primary action on the guest app is the single most visible
difference. The owner app uses blue, so the split is per-app, not global.

## Guest app

### Home
Blue hero. White search card floating over it containing destination
(magnifier), **Trip date** (calendar), guests (`2 adults • 2 children`), and a
full-width **orange Search** button. Below: an **"Explore nearby"** module —
an actual map with pins and a "View map" button — then "Exciting nearby…"
destinations.

> We have the search card and destination rails, but no map module on home.

### Search results
- App bar: back chevron, destination as title (`Miami`), criteria as subtitle
  (`Sep 21 • 2 adults • 2 children`). **No persistent search widget.**
- White toolbar, three equal segments: **Filter · Sort · Map**.
- Result cards are **horizontal**: photo left (~40%, full-bleed), content
  right — title, `★ 4.8 (98)`, pin + location, green ✓ `Instant confirmation`,
  outline heart top-right, and `trips from` + **$450 in green bold** at the
  bottom right.
- Photos carrying video get a **blue circular play badge**.

> Ours are vertical cards with a badge row (Boaters' Choice, In demand, checks).
> The real card is markedly cleaner and carries no award badges.

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

| # | Real app | This rebuild |
| --- | --- | --- |
| 1 | Orange primary CTA in the guest app | Blue |
| 2 | Horizontal search cards, photo left | Vertical, photo on top |
| 3 | Prices green; instant confirmation green text | Ink; blue badge |
| 4 | Video on listings, play badge on cards | No video at all |
| 5 | Filter · Sort · Map three-up toolbar | Filter/Map chips + sort dropdown |
| 6 | Real Google Maps | Schematic SVG map |
| 7 | Red scarcity line on listings | Not surfaced |
| 8 | Owner bookings: 2 tabs | 5 tabs |
| 9 | Status as green section-header strip | Inline pill badge |
| 10 | Owner calendar: scrolling month, selection mode, Sunday start | Listing × day matrix, Monday start |
| 11 | Quick Replies, delivery receipts, avatars, system rows in threads | None of these |
| 12 | Minimal owner listings screen | Dense with metrics |
| 13 | Guest shown as `Kevin S.` | Full name |
| 14 | Two separate apps | One app, role-routed |

## Still unmapped

Never shown in any store asset, so still inferred:

- **Owner Home** — the dashboard itself, the screen most directly asked about
- **Owner Menu** tab contents
- **Guest bottom navigation** (only the owner app's was shown)
- Booking and checkout flow
- Account, profile, payment methods, payouts, team, verification
- Everything below the fold on every screen above

Closing those needs either a logged-in session (the web app is Next.js and
ships its page payload in the HTML, so saved page source would give exact
structure) or the APK.
