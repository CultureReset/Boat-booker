# Platform map

The complete functional map of the real BoatBooker product — every route, every
screen, every state — recovered from public build artefacts, and measured
against this rebuild.

This is the companion to [`ANDROID-MAP.md`](ANDROID-MAP.md). That document maps
what the Android apps *look like*, from store screenshots. This one maps what
the platform *does*, from the shipped code.

---

## 1. How this was obtained

Three public sources, in order of how much they gave up.

**a. The Next.js build manifest.** `boatbooker.com` is a Next.js Pages Router
app. Its build manifest is served unauthenticated at
`/_next/static/<buildId>/_buildManifest.js` and contains `sortedPages` — the
complete route table, including every authenticated route. **79 routes.**

**b. The JavaScript chunks.** The manifest also maps each route to its code
chunks. All 289 were downloaded (7.7 MB). Grepping them for the i18n plumbing
found the translation loader:

```js
await client.get('next-api/cache/translations', {
  searchParams: { domains: t.join(','), language: r }
}).json()
```

**c. The translations endpoint.** `GET /next-api/cache/translations?domains=…&language=en`
serves any domain's full string catalogue with **no authentication**. It 404s
the whole batch on an unknown domain, which makes it a perfect oracle: a
candidate list can be bisected against it. 5,070 camelCase literals extracted
from the chunks were bisected in 9,865 requests.

**Result: 103 valid domains, 19,767 strings.** Including the ones behind login —
`captainDashboards` (901), `accountSettings` (729), `cancelBooking` (441),
`inbox` (297), `bookingFlow` (290).

### What this proves and what it doesn't

| Claim | Confidence |
| --- | --- |
| These 79 routes exist | **Verified** — from the app's own route table |
| These 103 domains and 19,767 strings are the real UI copy | **Verified** — served by the production API |
| A screen exists for feature X | **Verified** where a route and a domain both name it |
| Field lists, step counts, state names, validation rules | **Verified** — the strings enumerate them explicitly |
| Visual layout of authenticated screens | **Inferred**, except the 8 in `ANDROID-MAP.md` |
| Exact widget arrangement, spacing, colour | **Unmapped** unless a store screenshot shows it |

Strings tell you a screen has a "Step 3" heading reading *"Does this look
right?"*, a `%expiryTime% hours` countdown and an `Authorize payment and
confirm changes` button. They don't tell you where those sit on screen. Every
claim below is marked accordingly.

**Nothing here comes from an APK, a decompile, or a logged-in session.** All
three sources are unauthenticated public HTTP.

---

## 2. Product shape

One Next.js web app serves three audiences, split by URL namespace, and two
Android apps wrap subsets of it.

| Surface | Package / namespace | Audience |
| --- | --- | --- |
| Guest web | `/`, `/charters/*`, `/destinations/*` | Public + customers |
| Guest Android | `com.boatbooker.customers` | Customers |
| Operator web | `/manage/*` | Captains and charter operators |
| Operator Android | `com.boatbooker.captains` | Captains |
| Internal admin | `/manage/admin-home`, `/manage/users`, `/manage/tagger`, `/manage/redis`, `/manage/growthbook-cache` | BoatBooker staff |

Locales are `en | de | es | fr`, prefixed into the path. A GrowthBook cache
route confirms server-side feature flagging; several domains carry `V2` /
`exp-base` variants, so screens are A/B tested live.

The site is a **rebrand of FishingBooker**. Roughly 40 string keys still read
`fishingBooker`, `anglersChoice`, `fishing_type_offshore`, and the fish taxonomy
(248 strings) is intact — but the *values* have been remapped to boating
(`fishing_type_offshore` → "Water Sports"). This matters for a rebuild: **the
key namespace and the display copy disagree**, and any faithful port inherits
that.

---

## 3. Route table

All 79, grouped. `[x]` = dynamic segment, `[[...x]]` = optional catch-all.

### Public discovery (15)
```
/                                                     home
/charters/search/[[...params]]                        search results
/charters/search/exp-base/[[...params]]               search results, A/B variant
/charters/view/[id]                                   listing detail
/charters/view/[id]/preview                           owner's preview of own listing
/packages/view/[id]                                   single trip/package detail
/destinations/[destinationType]/[[...params]]         destination hub
/cross-section/[categoryName]/[categoryEntity]/[[...params]]   activity × destination
/cross-section-index/[categoryName]/[categoryEntity]  index of the above
/boating-near-me                                      geolocated search
/deals/[[...slug]]                                    seasonal + loyalty deal pages
/catches                                              social catch feed
/reviews/view/[id]                                    single review permalink
/profile/view/[userId]                                public user profile
/pages/whylist                                        why-list marketing
```

Rewrites make three of these public-facing under prettier URLs:
`/activity/:path*`, `/boat-type/:path*` and `/listing-type/:path*` all rewrite
into `/cross-section/*`, with the single-segment form going to
`/cross-section-index/*`.

### Booking and payment (12)
```
/charters/book/[step]/[id]        multi-step checkout
/charters/book/[step]/[id]/step2  second stage
/booking/processing               async payment settling ("stay on this page")
/booking/failed                   payment failure
/book-done                        confirmation
/post-checkout-flow               post-purchase upsell: invite buddies, get the app
/pay/balance                      pay remaining balance
/pay/tip                          tip the captain
/pay/tip/disabled                 captain prefers cash tips
/pay/session_expired              payment link expired
/pay/access_denied                not your payment link
/loyalty                          loyalty programme info
```

### Customer account (9)
```
/manage/bookings/customer                     bookings list
/manage/booking/customer/[bookingId]          booking detail
/manage/booking/change-requested/customer/[bookingId]   respond to a change request
/manage/account                               account hub
/manage/profile                               profile
/manage/login-and-security                    password + social connections
/manage/payment-methods                       saved cards
/manage/account-type                          switch customer → owner
/inbox/[[...params]]                          messaging (shared)
```

### Trip memories, wishlist, referrals (4)
```
/trip-memories              year-in-review index
/trip-memory/[bookingId]    a single animated trip recap
/shared-wishlist            a wishlist shared with a friend
/manage/booking/[bookingId]/buddy_invitation   invite a co-traveller
```

### Operator (17)
```
/manage/dashboard                                   home
/manage/booking/captain/[bookingId]                 booking detail
/manage/booking/requested/accept/[bookingId]        accept flow
/manage/booking/requested/decline/[bookingId]       decline flow
/manage/booking/cancel/[bookingId]/[reason]         cancel flow, reason in the URL
/manage/booking/change-requested/captain/[bookingId]  respond to change request
/manage/add-ons/[listingId]                         listing add-ons
/manage/itinerary/[listingId]/[packageId]           per-trip itinerary builder
/manage/performance/[[...category]]                 performance analytics
/manage/reports                                     trip reports
/manage/payments/settings/[id]                      per-listing payment models
/manage/direct/[[...params]]                        BoatBooker Direct
/opportunity-link-calendars                         cross-listing calendar linking
/offer/create                                       custom offer builder
/captain-onboarding, /captain-onboarding/[listingId]  onboarding checklist
/business-info/add                                  business/tax details
/team-members/invite/[inviteId]                     team member invite acceptance
/reviews/scan-qr-code/[charterId]                   QR review collection
/captainapp                                         owner app landing
```

### Auth (6)
```
/auth/login  /auth/signup  /auth/signup/partner  /auth/forgot_password
/finish-registration/[[...step]]   phone OTP + charter details
/direct                            BoatBooker Direct landing
```

### Internal admin (5)
```
/manage/admin-home  /manage/users  /manage/tagger  /manage/redis  /manage/growthbook-cache
```

### Infrastructure (11)
`/404` `/_app` `/_error` `/ping` `/staging` `/cpu-benchmark` `/kezman`
`/terms/[type]` and three more.

---

## 4. Domain index

103 domains, what each drives, and how many strings it holds. This *is* the
screen inventory.

| Domain | n | Drives |
| --- | ---: | --- |
| `destinations` | 9725 | Every destination's SEO prose |
| `termsOfUse` | 1007 | Legal |
| **`captainDashboards`** | **901** | **The entire operator app** |
| `viewCharterPage` | 742 | Listing detail |
| **`accountSettings`** | **729** | Payouts, business info, team, payment models |
| **`cancelBooking`** | **441** | Cancellation + the penalty engine |
| `contact` | 428 | Contact forms |
| `careers` | 299 | Careers |
| **`inbox`** | **297** | Messaging, offers, inquiries, safety |
| **`bookingFlow`** | **290** | Checkout |
| `filters` | 256 | Search facet taxonomy |
| `fish` | 248 | Species (legacy) |
| `searchResultsPage` | 227 | Results |
| **`changeBooking`** | **224** | 3-step booking change |
| `reviews` | 220 | Review write + display |
| `login` | 183 | Auth |
| `rulesAndGuidelines` | 166 | Policy |
| `search` | 157 | Search widget |
| `navigation` | 128 | Nav, footer, menus |
| `seo` | 121 | Meta |
| `destinationBlock` | 120 | Destination rails |
| `customerProfile` | 113 | Guest profile |
| **`push`** | **113** | **Push notification catalogue** |
| `whyList` / `whylist` | 101 / 101 | Why-list page (duplicated) |
| `createOffer` | 95 | Custom offer builder |
| `opportunities` | 94 | Listing improvement engine |
| `prompts` | 86 | Dashboard action prompts |
| `bookDone` | 85 | Confirmation |
| `email` | 85 | Transactional email |
| `directLandingPage` | 77 | BoatBooker Direct marketing |
| `pay` | 77 | Tip + balance payment |
| `tripItinerary` | 72 | Itinerary builder |
| `homepage` | 68 | Home |
| `priceBreakdownCustomer` | 67 | Guest-side price lines |
| `verification` | 66 | Document upload |
| `finishRegistration` | 65 | Phone OTP |
| `bookingPricing` | 61 | Shared price lines |
| `safety` | 56 | Safety |
| `addBusinessInfo` | 54 | Business/tax form |
| `declineBooking` | 54 | Decline flow |
| `loyaltyInfoPage` | 52 | Loyalty |
| `managePaymentMethods` | 50 | Cards |
| `packageCard` | 49 | Trip cards |
| `general` | 46 | Shared |
| `anglersChoice` | 44 | Awards programme |
| `about` | 42 | About |
| `postCheckoutFlow` | 42 | Post-purchase |
| `MessageCaptainModal` | 41 | Inquiry modal |
| `sitemap` | 41 | Sitemap |
| `tripMemory` | 41 | Animated trip recap |
| `quickReplies` | 40 | Canned operator replies |
| `calendar` | 39 | Date vocabulary + calendar sync |
| `referrals` | 39 | Referrals |
| `manageBookingsCustomer` | 38 | Guest bookings list |
| `loginAndSecurity` | 37 | Password + OAuth |
| `nearMe` | 37 | Near-me page |
| `catches` | 36 | Catch feed |
| `currency` | 36 | 36 currency names |
| `dealsPage` | 34 | Deals |
| `accessibilityStatement` | 29 | Legal |
| `captainOnboarding` | 28 | Onboarding |
| `priceBreakdownCaptain` | 28 | Operator price lines |
| `crossSectionPages` | 26 | Activity × destination |
| `adminHome` | 25 | Internal admin |
| `activities` `listingCard` | 24 each | Taxonomy, cards |
| `wishlist` | 22 | Wishlist |
| `availabilityForm` | 21 | Availability picker |
| `maps` | 19 | Map |
| `captainAppLandingPage` | 17 | App landing |
| `fishingTechniques` | 16 | Taxonomy |
| `customerAccount` | 15 | Account hub cards |
| `accountType` | 13 | Role switch |
| `cancellationPolicy` `notifications` `phoneNumber` | 12 each | |
| `bookingCard` `bookingSuccess` | 11 each | |
| `breadcrumbs` `newBadge` | 10 each | |
| `authentication` `crew` `pickers` `sharedWishlist` | 9 each | |
| `bookings` `form` `page404` | 8 each | |
| `scanQrCode` | 7 | QR review |
| `press` `weather` | 6 each | |
| `appPromotionAlert` `gallery` | 4 each | |
| `bookingProcessing` | 3 | |
| `cards` `nextjsGlobal` `reviewScore` `tripMemories` | 2 each | |
| `manageBookings` | 1 | |
| `bookingDetails` `manageReports` `reportInappropriateListings` `searchFilters` | 0 | Registered, empty |

---

## 5. Guest app, screen by screen

### 5.1 Bottom navigation — **inferred**

The owner app's bottom bar is confirmed from a store screenshot (Home ·
Calendar · Bookings · Inbox · Menu). The guest app's was never shown. What
`navigation` *does* confirm is a labelled set: `home` · `inbox` (with an
`inboxCount` plural) · `myBookings` · `myWishlist` · `account` · `more`.

Also in `navigation`, and worth noting: **offline state is a first-class
concern** — `youAreOffline` ("You're offline. Please check your internet
connection.") and `youAreBackOnline`. Consistent with a native shell.

### 5.2 Search and filters — **verified taxonomy**

`filters` (256) is the complete facet vocabulary. Groups:

- **Listing type** — Charter · Boat Rental · Boat Tour · Lodge · Outfitter
- **Boat size** — under 20 ft / 20-29 / 30-39 / 40-49 / 50+
- **Duration (V2)** — Short trips (≤3h) · Half day (4-5h) · 3/4 day (6-7h) ·
  Full day (8-10h) · Extended (10+h) · Multi-day. Each carries a *description*
  string, so the UI shows the hour range under the label.
- **Departure** — Morning · Afternoon · Evening · Night
- **Review score** — 4.25+ / 4.50+ / 4.75+ (not whole stars)
- **Policies** — Free Cancellation · Instant Book · Loyalty Program · Boaters' Choice
- **Activities** — 30+, e.g. Sunset & Dinner Cruises, Jet Ski Tours, Snorkeling
  & Diving, Booze Cruises, Swimming With Pigs, Parasailing, Eco-Tours,
  Bachelorette & Bachelor Parties, Proposal & Engagement Trips
- **Boat types** — 40+, Center Console through Motoryacht, Panga, Airboat, Gulet
- **Amenities** — 60+, in sub-groups (safety: EPIRB, Liferaft, Flares, CPR-Trained
  Crew; comfort: A/C, Bimini, Teak Deck, Outdoor Shower; provisions: Lunch,
  Snacks, Drinks, Alcohol, Grill)
- **Allowed on board** — Pets · Smoking · Glass Bottles · Children · Shoes
- **Payment methods accepted** — Cash, Visa, Mastercard, Amex, PayPal, Checks,
  Bank Transfer

There is also a **family-friendly interstitial**: *"Bringing the kids along? We
picked charters rated consistently high by other families with kids."* — an
interrupt triggered by children in the group size.

### 5.3 Checkout — **verified structure**

Route `/charters/book/[step]/[id]` (+ `/step2`), domain `bookingFlow` (290).

Field set: first name, last name, email (with a typo-warning tooltip: *"Watch
out for typos"* / *"Double-check for misspellings"*), phone, **optional
password** (`bookingPasswordPlaceholder`: "To manage your booking online"), and
a `Special Requests` free-text box.

Guest checkout is explicit — `noAccountNeeded` ("No account needed!"),
`noAccountNeededDesc` ("Booking takes just 2 minutes."). **Account creation is
optional at checkout.**

Payment: Credit Card · PayPal · **Apple Pay** (with a pre-redirect notice).
Coupons via `enterCouponPlaceholder`.

Payment mode is chosen by the guest under `choosePaymentModel` ("How do you
want to pay?"): pay deposit upfront, or pay in full. A **short-notice branch**
exists — when the trip is under a day out, the copy changes and an *alternate
dates* field appears instead of the normal comments box:

> *"This is a short notice booking. There's a chance the captain can't prepare
> for the trip in time…"* — and `commentsLabelShortnotice`: **Alternate dates**.

Scarcity and trust modules, all real: `bookedXTimesLast7Days`,
`bookedXHoursYMinutesAgo`, `consideringBooking` ("N are considering booking this
charter right now"), `inHighDemand`, `justBooked`, `bestPriceGuaranteed` ("Found
the same trip for less? We'll refund the difference!"), `nortonSecurityStandards`,
and a press quote — *"Boating Has Its Own Airbnb" — Outside Magazine*.

`/booking/processing` is a **dedicated async settlement screen** ("Your payment
is still being processed. Please stay on this page.") — the payment provider is
asynchronous and the app polls.

### 5.4 Price breakdown — **verified line items**

From `priceBreakdownCustomer` (67) + `bookingPricing` (61):

```
Trip price
  Loyalty discount            (%discountPercentage%%)
  Prepaid credit
  Cashback                    "We'll refund you after your trip."
Service fee                   "covers customer support, platform maintenance…"
Processing fee                "covers the cost of processing your payment…"
─────────────────────────────
You pay today (%depositPercentage%%)
Remaining balance (%paymentDate%)
  → pay directly to the captain, or
  → pay online any time, or
  → auto-charged on %paymentDate%  ("We'll charge automatically on…")
Tip                           not included; gratuity customary
```

Three distinct remaining-balance behaviours (**direct / online / scheduled
auto-pay**, each cancellable) are a materially more complex model than a single
due-on-arrival split.

Also present: `amountReserved` — *"A temporary hold placed on your card to
secure your booking"* — a **pre-auth hold**, distinct from a charge.

### 5.5 Cancellation policy — **verified**

`cancellationPolicy` (12) defines a three-node timeline: *Booking confirmed* →
*%p% before trip* → *Trip date*. Free cancellation ends at **12:00 AM local
time** on the cut-off date. After it, free cancellation survives only for
unsafe weather. Non-refundable listings show `noCancellationsPolicyInfo`.

### 5.6 Change a booking — **verified 3-step flow**

`changeBooking` (224), route `/manage/booking/change-requested/{captain,customer}/[bookingId]`.

| Step | Heading | Contents |
| --- | --- | --- |
| 1 | *What do you want to change?* | Trip date · group size · departure time · number of days · trip package. Shared trips **cannot** change group size. Per-field availability errors. |
| 2 | *Let your captain know why…* | Free-text note, delivered to the counterparty's inbox |
| 3 | *Does this look right?* | Old → new diff with strikethrough, price difference, expiry countdown |

Either party can request. The other has `%expiryTime%` hours to respond.
Accept applies immediately **unless the price changes**, in which case it
routes to human support ("we will get back to you within 24 hours"). A request
can be **withdrawn**, and it can **expire** — with distinct copy for *you were
unresponsive* vs *they were unresponsive*. Positive price differences aren't
charged until acceptance.

### 5.7 Cancellation — **verified reason taxonomy**

`cancelBooking` (441) is the third-largest domain. Route carries the reason:
`/manage/booking/cancel/[bookingId]/[reason]`.

Customer reasons: *Can't go on a boat trip* · *My plans have changed* · *I found
a better deal* (→ on BoatBooker.com / on another website / captain offered a
lower rate) · *Need to change details* · *My captain needs to cancel* ·
*Extenuating circumstances* · *COVID-19*.

Captain reasons: *Bad weather* · *Boat malfunction* · *Boat out of the water* ·
*Already booked on that date* · *Not enough people (shared trip)* · *Customer
wants to cancel* · *Requested activity is not available* · *Trip price is
incorrect* · *I want to unlist* · *I am moving to another location* · *I can't
accommodate capacity*.

The genuinely distinctive part is **the penalty engine**. Cancelling as an
operator shows an itemised consequence list before confirming:

| Penalty | Copy |
| --- | --- |
| Ranking drop | *"Our system has temporarily decreased your ranking"* — reliability score fell |
| Calendar blocked | *"We'll keep your calendar blocked for this time slot"* |
| Calendar opened | *"We'll make your calendar available for this date"* |
| Automatic review | *"You'll receive an automatic cancellation review"* — posted publicly, doesn't affect star rating |
| Instant Book warning | *"You'll lose the Instant Book feature after 4 double bookings in a year"* |
| Instant Book lost | Deactivated for 1 year |
| Customer refund | |

Impact is graded — `penaltyImpactInfo{Low,Medium,High,VeryHigh}` — and shown
as *"Low/Medium/High/Very high impact on ranking"*. Weather, extenuating
circumstances, COVID and not-enough-people are explicitly **penalty-free**.

### 5.8 Bookings list — **verified**

`manageBookingsCustomer` (38). Three sections with counts: **Upcoming Trips
(n)** · **Past Trips (n)** · **Canceled Trips (n)**.

Payment badges per row: `Deposit secured` · `Payment secured` · `Fully paid` ·
`Fully paid & tipped`. Actions: `Pay now` (remaining balance) · `Leave a tip` ·
`Rate your trip` / `Leave a review` · `See memories` · `View details`.

Eleven booking statuses, shared with the operator side (`bookingCard`):

```
Request · Pending · Confirmed · Accepted · Change requested ·
Change pending · Cancel requested · Canceled · Declined · Withdrawn · Done
```

Note **Accepted** (operator vocabulary) and **Confirmed** (guest vocabulary)
coexist as separate statuses, and `Done` is the terminal state, not "Completed".

### 5.9 Inbox — **verified, and far richer than a chat**

`inbox` (297) is a whole product. Beyond messaging:

**Thread types.** Booking threads, **inquiry** threads, **offer** threads, and
an official **Support** channel (`supportFirstMessage`: "Hi! How can we help
you?", with a ticket number, a status, and an expected response time).

**System event rows** rendered inline, each a linked booking reference:
booking requested / received / accepted / confirmed / declined / canceled /
completed, change requested / accepted / declined / withdrawn / expired, offer
sent / withdrawn / expired, inquiry declined. Each has a *you* and a *them*
variant.

**Message affordances.** Edit (within 15 min) · Delete (within 24 h, "deleted
for all participants") · Copy · Mark read/unread · Archive/unarchive · typing
indicator · `Delivered` receipt · `Edited` marker · inline photos.

**Filters.** Latest · Unread · Priority · Support.

**Anti-bypass enforcement — three separate mechanisms:**

1. `contactInfoModal` — before a booking is confirmed, phone numbers, emails
   and links are **stripped**: *"For safety reasons, contact details and links
   can only be shared after your booking is confirmed."* It lists what to remove.
2. `bypassModal` — *"This message can't be sent. Messages requesting
   off-platform contact or payment aren't allowed. Repeated violations…"* Plus
   a `bypassWarning` **push notification**, and a `bypassMessageLabel` shown
   inline on a borderline message: *"This message may violate our policy."*
3. `beCarefulBanner` — a fraud-signal banner on the thread: *"This conversation
   shows unusual activity. Tap to review."* → a modal with a **Report** action.

Off-platform booking attempts feed the account-health system, which can pause a
listing (see §6.5).

**Messaging can be locked**: if the captain has no public listings, both sides
see a locked composer with a CTA — *Browse similar trips* / *Go to listings*.

**Custom offers from the thread.** An operator can build an offer from an
existing private trip or from a brand-new custom trip, set a custom price
("If you want to provide discounts for children, military, etc."), and send it
with an hours-long validity window during which the calendar stays open.

### 5.10 Trip memories — **verified, and unique**

`/trip-memories`, `/trip-memory/[bookingId]`, domain `tripMemory` (41). A
**Spotify-Wrapped-style animated recap** of a past trip, with Next / Back /
Replay navigation:

1. `👋 %name%` — *"We've compiled a memory of your boating adventure from %years%"*
2. The trip, with `%x% years ago`
3. *"You picked a trip other customers enjoyed too!"*
4. *"Your captain's reputation keeps growing"* — reviews since your trip
5. *"Boat on the same dates this year"* — availability calendar, with a loyalty
   discount overlay; captain message *"Pick your date, %name% – I'll hold your
   spot"*, or if booked out, *"Hi %name%, looks like we're busy here — see my
   other dates."*
6. *"Feeling adventurous?"* — similar charters nearby
7. *"Create new memories on the water"*

Error states are in-voice: *"Trip off the radar 🤷‍♂️"*, *"We've searched the
seven seas but couldn't find this boating memory."*

### 5.11 Other guest features

| Feature | Route / domain | What it is |
| --- | --- | --- |
| **Tipping** | `/pay/tip`, `pay` | 5–50% of the **original** trip price, preset or custom, with a "tip in person" disabled state |
| **Pay balance** | `/pay/balance` | Standalone payment link; has expired and access-denied states |
| **Shared wishlist** | `/shared-wishlist` | *"%propertiesCount% properties saved"*; friends' saves appear live |
| **Buddy invitation** | `/manage/booking/[id]/buddy_invitation` | Invite a co-traveller to a booking |
| **Referrals** | `referrals` | Give $X / get $Y, email + link + Facebook + Messenger + SMS; per-invitee state (*hasn't signed up* / *registered but hasn't booked* / *has booked first trip*) |
| **Loyalty** | `/loyalty` | 3 tiers, up to 20% off, unlocked by trips completed **per 2 years**; discount marked by an orange `fa-badge-percent` |
| **Catches** | `/catches` | Social feed, filterable by month/season, likes and shares, with a sign-in nudge after N items |
| **QR reviews** | `/reviews/scan-qr-code/[charterId]` | Captain shows a QR; guest scans to leave a review |
| **Deals** | `/deals/[[...slug]]` | Seasonal campaign pages (Holiday, Thanksgiving, Boaters' Choice) |
| **Post-checkout** | `/post-checkout-flow` | Invite buddies, verify email, get the app |

---

## 6. Operator app, screen by screen

`captainDashboards` (901) is the single largest functional domain and covers
essentially the whole operator product.

### 6.1 Home

`welcomeMessage` — *"Welcome, %name%!"*. Onboarding copy names the five things
the redesigned home does:

> *Your home base just got better. Now you can:* manage your upcoming trips ·
> see important notifications · **track your performance** · optimize your
> listings · learn about best practices

Modules (**verified present**, layout **inferred**):

- **To-dos** (`captainNotificationsTitle`) — action queue
- **Booking requests** (`bookingsTitle`) — empty: *"You have no booking requests
  to respond to right now."*
- **Upcoming trips** / **Today** — *"No trips today."*
- **Listing page views** (`statsTitle`, with `(all listings)`) — a chart, with
  a real empty state: *"Not enough data to show stats for this month."*
- **Insights** — *"All metrics are calculated for last 4 weeks."* → See all insights
- **Opportunities** — *"See all opportunities"*
- **Next steps** (`nextSteps`, `xStepsLeft`) — *"Complete these steps to increase
  visibility, build trust with customers, and unlock advanced payment options."*
- **Reviews & Rating**
- **Release banners** — Winter Release 2023, Summer Release 2024, "Refreshed
  dashboard"

**Notifications** are a full sub-app: typed (`General` · `Onboarding` ·
`Product update` · `Ticket`), each tab counted, archivable and restorable, with
a separate *Archived Notifications* view. Ticket notifications carry a ticket ID
and status and link to support.

### 6.2 Next steps / prompts — **verified**

`prompts` (86) drives the action queue. Each prompt has a title, description,
CTA, a FontAwesome icon name (`faSuitcase`, `faShieldCheck`,
`faMoneyBillWave`, `faCircleExclamation`) and a *required to* label:

| Prompt | Required to |
| --- | --- |
| Verify your email | — |
| Complete listing | **Required to publish** |
| Get verified | **Required to publish** |
| Add business info | **Required to get paid** |
| Add payout method | **Required to get paid** |
| Collect your %amount% | **Required to payout your %amount%** |
| Complete payout setup (ACH → Stripe migration) | Required for payouts processing |

### 6.3 Bookings

Filters: **Today (n)** · **Upcoming (n)** · **Requests (n)** · **All (n)**, plus
a date-range filter that can key on **trip date** or **search date**, a
per-listing filter, and status filters. **Export to CSV** and **Import CSV**
both exist.

Booking detail is state-driven, with distinct body copy for each state —
request, reschedule, accepted, declined, canceled, done-with-review,
done-without-review, pending-review. Actions: Accept · Decline · Cancel ·
Change booking · Message customer · **Call customer** · Email customer ·
Report cancellation (no-show) · **Add to Google Calendar** (a fully templated
body with booking ID, guest name, totals, group size, and deep links to view,
change and cancel).

The **accept screen** shows a *Request summary*: Customer · Date · Listing ·
Trip · Deposit/Commission (%) · Total price · **You Earn** — with the standing
instruction *"Please check if the customer has provided additional info
(Additional comments / Staying at) before accepting."*

### 6.4 Calendar

Beyond the scrolling-month UI confirmed from screenshots: **external calendar
sync** (`calendar` domain names Google Calendar and iCloud, with a "how to find
the calendar address" help panel), and **cross-listing calendar linking**
(`/opportunity-link-calendars`) so a booking on one listing blocks the shared
boat on another.

Day states: booked · blocked · not a working day · seasonality · short notice ·
system short notice · destination blocked · calendar locked · external calendar.

### 6.5 Listings, opportunities and account health

Listing statuses: `published` · `unpublished` · `snoozed` (with
`snoozedUntil`) · `suspended` ("paused") · `deactivated`.

**Opportunities** (`opportunities`, 94) is a listing-completeness engine, not a
checklist. Grouped into three contexts — *Stand out* · *Make it easy to book* ·
*Each trip, in detail* — and six categories (gallery quality, captain profile,
trips, itineraries, availability, reviews). ~30 concrete opportunities,
each with a title and rationale, e.g.:

- *Show your boat from every angle* / *Show what it's like on board* / *Organize your photos*
- *Choose Instant Book for your trips* — *"Let customers book and confirm a trip date instantly"*
- *Decrease advance notice period* · *Lower your free cancellation period limit*
- *Link your BoatBooker calendars*
- *Add itineraries to %missing_count% trips* · *Finish %draft_count% draft itinerary*
- *Add targeted species for: %title%* · *Add a description for: %title%*
- Amenity-detail prompts: type of toilet, lunch, snacks, drinks, live bait,
  first mate tipping, children age limits, catch cleaning charges

Progress is scored on a 0-5 chart with per-band copy (`chart0`…`chart5`).

**Account health can suspend a listing.** `prompts` enumerates the reasons, each
in two severities — *booking limit reached (%current%/%limit%)* or *listing
paused*:

| Reason | Copy |
| --- | --- |
| Boat malfunction | *frequent boat issues* |
| Bypass attempts | *off-platform booking attempts* |
| Low realization rate | *low trip completion rate* |
| Low account health | *account inactivity* |
| Credentials missing | *Listing not verified. Upload your credentials to go live.* |

This is a **graduated throttle** — capping new bookings before pausing outright.

### 6.6 Trip itinerary builder — **verified**

`/manage/itinerary/[listingId]/[packageId]`, domain `tripItinerary` (72).

Per-trip, per-day, ordered steps. Each step: name (*"E.g. Departure from marina,
Snorkeling stop at reef"*), description, optional duration, and a **meeting
point** marker. Steps reorder with move up/down. Multi-day trips need an
itinerary on **every** day.

Publish gate: **at least 2 steps** (`addAtLeastStepsToPublish`, `%minSteps%`).
Draft → published lifecycle, and published itineraries must be **unpublished to
edit** — with an unsaved-changes guard on navigate-away.

### 6.7 Payments, payouts and business info

`accountSettings` (729) is where the commercial machinery lives.

**Payment models**, toggled per listing at `/manage/payments/settings/[id]`, at
least one always active:

| Model | Behaviour |
| --- | --- |
| **Deposit** | Guest pays a deposit up front; operator collects the balance. Percentage configurable. |
| **Full upfront** (Online Payments) | Guest pays 100%; `%percentage%% + $%fixedValue%` processing fee |
| **Remaining balance** | Guest pays the balance online, proactively or on request |
| **Tip** | Online tipping |

Two commission structures: **commission-as-deposit** (BoatBooker keeps the
deposit as commission after the trip; BoatBooker covers processing; manual
payouts take 3-5 business days) vs **Online Payments** (Stripe; automatic
payout; higher deposit → fewer cancellations). The trade-offs are spelled out
in-product.

**Who covers the processing fee** is a per-operator choice, but only in some
US states — *"Currently, transaction fees can be transferred to customers in:
Florida, North …"*.

**Payout methods**: Bank account (ACH) · Check · PayPal · Wire Transfer
(*"only if the payout amount exceeds $200"*). Plus **instant payouts** — funds
immediately after each trip, 1% fee. Payouts are **operator-approved**: an
invoice appears, the operator approves, funds land in 2-3 business days. Tax
documents appear once a reporting threshold is reached.

**Business info** (`addBusinessInfo`, 54): registered business vs sole
proprietor, legal name, EIN or SSN, exact founding-document address (**P.O.
boxes rejected**), DOB, billing country. There is an explicit *"Is this business
info correct?"* confirmation, a Stripe-suspended recovery path (*"The business
name and EIN don't match"*), and country/business-type changes are gated once
Online Payments is live.

**Team members** (`crew`): Captain · First mate · Business partner · Other, each
with a description. Access levels, per-listing assignment, and an explicit
**consent gate** — *"I have acquired consent from my team member to share their
personal information."*

### 6.8 Verification — **verified**

`verification` (66) + `captainOnboarding` (28). Documents:

- Captain's License
- Boat Registration Certificate
- Insurance Policy (must show expiry)
- Charter Fishing or Business License
- Federal Permits
- Government ID
- **VIC card** → US **Veteran-Owned badge**

Per-document status: not submitted · in review (*"Our team is reviewing your
submission — no action needed"*) · valid · expired · invalid · locked. Missing
documents are reported **per listing**: *"We're missing the Insurance Policy for
%missingCharters%."*

Listing badge levels: **Basic check** · **Enhanced check** · **Incomplete** ·
**Missing credentials**, each with popover copy. Review SLA is stated as 1-2
business days.

### 6.9 Performance and awards

`/manage/performance/[[...category]]`. Metrics: **Total views** · **Overall
conversion rate** · **Realization rate** (a.k.a. reliability score) ·
**Response rate** · **Overall rating** · **Verified reviews** — each with
year-on-year deltas (`%p%% up YoY` / `down YoY` / `No change YoY`), and views /
requests / bookings breakdowns by listing.

**Boaters' Choice Award** (`anglersChoice` 44 + in-dashboard tracker). Awarded
to the **top 10% worldwide**, assessed **quarterly** (Jan 1, Apr 1, Jul 1,
Oct 1) over a trailing 12 months. Criteria, with live progress bars:

| Criterion | Threshold |
| --- | --- |
| Average review score | **4.8+** |
| Verified reviews | **10+** |
| Reliability score | **98%** |
| Response rate | **98%** within 24 h |
| Full verification | all listings |

Winners get a downloadable banner and website widgets.

### 6.10 Widget Center

Eight embeddable widgets: Boaters' Choice · Calendar · Charter Recommendation ·
Review Snippets · Review Stats · Weather · Your Rating · Your Trips. Each is
configurable (size, colour, shadow, units — imperial °F/ft/kts vs metric
°C/m/km/h) and produces HTML, with an **Email to webmaster** button.

### 6.11 BoatBooker Direct

`/direct` (marketing), `/manage/direct/*` (product). A **zero-commission**
channel: the operator gets a link and a QR code to put on their own site,
social media, decals or business cards. Guests book and pay through
BoatBooker's rails, and the trip lands in the same calendar and inbox.

- Cost: **2.65% + $0.30** transaction fee only, no commission
- Requires Online Payments; US-only at present
- Includes **Add booking manually** for walk-up and phone bookings
- **Invite to book** — email, SMS, or QR code, each leading to a page with the
  operator's availability, pricing and a book button

### 6.12 Quick Replies

`quickReplies` (40). Named message templates with **variable placeholders**
(*"e.g. Hey {{customer_name}} thanks for booking with us"*), managed in a
dedicated CRUD screen and inserted (and editable) before sending. Invalid
placeholders are caught: *"We can't retrieve information for some
personalization fields."*

### 6.13 Operator misc

Trip reports (`newFishingReport` — "New Boat Trip Report"), review requests
(*"Invite people to review you"*, with `invited` / `reviewed` state per
invitee), review replies, and a **free professional video** programme — an
invite-only offer (*"You've been selected for a free video shoot"* / *"Claim
your spot"* / *"Maybe next time"*).

---

## 7. Push notifications — **verified catalogue**

`push` (113) is the full notification taxonomy, and confirms the mobile apps
are the primary channel. 56 notification types, each with a title and body,
most with separate captain and customer variants.

**Transactional:** new booking (`💸️ New Booking Request!`), instant booking,
accepted, declined, canceled (by either party), request expired
(`🔻 Your ranking was affected`), change requested/accepted/declined/expired/
withdrawn, inquiry declined, offer sent/reminder/last-chance/expired/withdrawn,
new message, new photo, trip reminder (`Fair winds` / `Trip is coming up`),
new review, review approved, review reply, remaining balance paid
(`💰 Remaining balance paid`), tip received (`💰 %customerFullName% sent a tip!`),
scheduled payment reminder and failure, payout approval required
(`Action Required: Approve payout`), Instant Book disabled, message blocked.

**Lifecycle / marketing:** cart abandonment (three staged sends), book again
after trip, book an additional trip, **trip anniversary**
(*"%name%, it's your boataversary today 🚤"*), availability reminder
(*"Block out unavailable dates to ensure visibility in search results"*),
report reminder.

`notifications` (12) confirms three channels the guest can toggle
per-category: **Email · SMS · App notification**.

---

## 8. Booking state machine — **verified**

Reconstructed from `bookingCard`, `inbox` system events, `captainDashboards`
state copy and the `push` catalogue.

```
                    ┌──── instant book ─────────────────────┐
                    │                                       ▼
  inquiry ──▶ offer ──▶ Request ──accept──▶ Accepted/Confirmed ──trip date──▶ Done
     │          │          │                    │      ▲                        │
     │          │          ├─decline─▶ Declined │      │                        ├─▶ review
     │          │          ├─withdraw▶ Withdrawn│      │                        └─▶ tip
     │          │          └─expire──▶ Expired  │      │
     │          └─ expire / withdraw            │      │
     └─ decline                                 │      │
                                                ▼      │
                                     Change requested ─┤ accept (no price change)
                                                │      │
                                                ├──────┘
                                                ├─decline─▶ back to Accepted
                                                ├─withdraw▶ back to Accepted
                                                ├─expire──▶ back to Accepted
                                                └─price change ─▶ manual support review (24 h)

  Accepted ──cancel request──▶ Cancel requested ──▶ Canceled
                                                     └─▶ penalty assessment (operator side)
```

Response windows are hours-denominated and surfaced live to both parties
(`%remainingTime% hours`). Everything expires.

---

## 9. Gap analysis

What the real platform has, and where this rebuild stands.

### Built and broadly faithful

Search with facets · listing detail · availability · quote and checkout ·
booking accept/decline/cancel · calendar · messaging · reviews · wishlist ·
payouts · team · verification · loyalty · referrals · notifications · owner
dashboard · listing editor · SEO index pages · widgets.

### Built since this map was written

All 26 gaps below have been closed except the last, which is deliberate.
Each row names the route the rebuild serves it on and the service that owns
the rules, so the claim can be checked rather than taken.

| # | Feature | Route(s) here | Service |
| --- | --- | --- | --- |
| 1 | **Custom offers** | `/offer/create`, `/account/inbox/[id]` | `services/offers.ts` |
| 2 | **Booking change requests** | `/account/bookings/[id]/change` | `services/changes.ts` |
| 3 | **Cancellation penalty engine** | `/account/bookings/[id]/cancel` | `services/cancellation.ts` |
| 4 | **Account-health throttling** | — (enforced at booking) | `services/cancellation.ts` |
| 5 | **Online tipping** | `/pay/tip` | `services/payments.ts` |
| 6 | **Pay-balance-later** | `/pay/balance` | `services/payments.ts` |
| 7 | **Trip itinerary builder** | `/owner/listings/[id]/itineraries` | `services/itineraries.ts` |
| 8 | **Opportunities engine** | `/owner/opportunities` | `services/opportunities.ts` |
| 9 | **BoatBooker Direct** | `/owner/direct`, `/direct` | `services/direct.ts` |
| 10 | **Quick Replies** | `/owner/quick-replies` | `services/direct.ts` |
| 11 | **Trip memories** | `/trip-memories`, `/trip-memory/[id]` | `services/memories.ts` |
| 12 | **Anti-bypass enforcement** | `/account/inbox/[id]` | `services/moderation.ts` |
| 13 | **Performance analytics** | `/owner/performance` | `services/performance.ts` |
| 14 | **Calendar sync + linking** | `/owner/calendar/links` | `services/availability.ts` |
| 15 | **Push notifications** | `/account/notifications` | `services/notificationCatalogue.ts` |
| 16 | **Listing add-ons** | `/owner/listings/[id]/add-ons` | `services/charters.ts` |
| 17 | **Shared wishlists** | `/shared-wishlist` | `services/memories.ts` |
| 18 | **Buddy invitations** | `/manage/booking/[id]/buddy_invitation` | `services/memories.ts` |
| 19 | **QR review collection** | `/reviews/scan-qr-code/[id]` | `services/direct.ts` |
| 20 | **Catches feed** | `/catches` | seeded, `services/memories.ts` |
| 21 | **Deals pages** | `/deals/[[...slug]]` | `services/deals.ts`, `config/campaigns.ts` |
| 22 | **Public profiles** | `/profile/view/[userId]` | `services/memories.ts` |
| 23 | **Async payment states** | `/booking/processing`, `/booking/failed` | `services/payments.ts` |
| 24 | **Phone OTP registration** | `/finish-registration` | `services/verification.ts` |
| 25 | **Apple Pay / PayPal** | `/account/payment-methods` | `services/accounts.ts` |
| 26 | **Internal admin** | **not built** | Out of scope for a rebuild |

**Still absent, on purpose.** Internal admin (row 26) is staff tooling, not
product. Real Google Maps is replaced by a schematic SVG, because a map key
cannot be committed and the tiles would not load offline. Media — photos and
video alike — is represented by deterministic gradients and a poster/badge,
because there is no bitmap or clip to serve; the *model* carries the fields a
real deployment would fill.

### Modelled differently

| Area | Real | Here |
| --- | --- | --- |
| Booking statuses | 11 | 6 |
| Payment models | 4, per-listing, operator-toggled | 3 fixed modes |
| Commission | Two structures (deposit-as-commission vs Stripe) | Single service-fee rate |
| Payout methods | ACH · Check · PayPal · Wire · Instant | Generic payout methods |
| Cancellation | Reason taxonomy + penalty assessment | Refund calculation only |
| Verification | 7 document types, 6 statuses, per-listing | Simplified |
| Team roles | 4 typed roles + access levels + consent gate | Flat list |
| Locales | en · de · es · fr | en |
| Currencies | 36 | 36 ✓ |

---

## 10. Still unmapped

Honest inventory of what remains unknown after all three sources.

**Visual layout of every authenticated screen except the eight in
`ANDROID-MAP.md`.** Strings enumerate fields, steps and states; they do not
give arrangement, spacing, hierarchy or colour. The operator Home — the screen
most directly asked about — is now fully mapped *functionally* but its layout
is still inferred.

**Also unknown:**

- Everything below the fold on the eight screenshotted screens
- The guest app's bottom navigation (only the operator's was shown)
- Native-only surfaces: offline behaviour, camera/upload flows, deep links,
  biometric login, widgets
- Which features are gated by feature flag rather than universally shipped
  (a GrowthBook route exists, and several domains carry `V2` variants)
- Server-side business rules not expressed in copy: exact ranking weights, the
  realization-rate formula, booking-cap thresholds
- The API request/response shapes behind authenticated screens

Closing the visual gap needs a logged-in session or the APK. Closing the rules
gap needs neither — those aren't public anywhere.

---

## 11. Reproducing this

```bash
# 1. Route table
curl -s https://boatbooker.com/ | grep -o '/_next/static/[^/]*/_buildManifest.js'
curl -s "https://boatbooker.com/_next/static/<buildId>/_buildManifest.js" -o bm.js
node -e 'global.self={};eval(require("fs").readFileSync("bm.js","utf8"));
         console.log(self.__BUILD_MANIFEST.sortedPages.join("\n"))'

# 2. Any domain's strings
curl -s "https://boatbooker.com/next-api/cache/translations?domains=captainDashboards&language=en"
```

The build ID rotates on every deploy; re-read it from the homepage HTML.
`language` accepts `en`, `de`, `es`, `fr`.

[`platform-map.json`](platform-map.json) carries the same inventory in
machine-readable form — all 79 routes and all 103 domains with their string
counts. Counts only: the strings are BoatBooker's copy and are not reproduced
in this repository.
