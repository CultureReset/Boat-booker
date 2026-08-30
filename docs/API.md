# API

All endpoints return one envelope:

```jsonc
// success
{ "data": { … }, "code": 200, "metadata": { … } }   // metadata only where paged

// failure
{ "error": { "code": "unavailable", "message": "…", "details": [] }, "code": 409 }
```

The client wrapper (`lib/client/api.ts`) unwraps `data` and throws `ApiError`
on the failure shape, so callers use plain try/catch and never inspect status
codes by hand.

Auth is a signed HttpOnly cookie (`bb_session`) sent automatically. Endpoints
marked **auth** return 401 without one; **owner** additionally returns 403 for
a customer account.

---

## Auth

### `POST /api/auth/login`
```jsonc
{ "email": "guest@boatbooker.demo", "password": "Password123" }
→ { "user": { "id": "…", "email": "…", "role": "customer", … } }
```
Returns the same 401 for an unknown address and a wrong password, so the
endpoint cannot be used to discover which addresses are registered. Rate
limited to 10/min per IP. Upgrades the stored digest on login if the work
factor has risen.

### `POST /api/auth/signup`
```jsonc
{ "email", "password", "firstName", "lastName",
  "phone?", "accountType": "customer" | "owner", "companyName?", "referralCode?" }
→ 201 { "user": { … } }
```
`companyName` is required when `accountType` is `owner`. Password must satisfy
all four rules; failures come back as `details: ["passwordContainsNumber", …]`.

### `POST /api/auth/magic-link`
```jsonc
{ "email", "intent": "customer" | "owner" }
→ { "email", "sent": true, "loginUrl": "/login/verify?token=…" }
```
`loginUrl` is present only while `AUTH_EXPOSE_MAGIC_LINK !== 'false'`. **Set it
to `false` in production** — otherwise anyone could request a link for any
address and read it out of the response.

### `GET /api/auth/magic-link?token=…`
Consumes a single-use, 15-minute token. Creates the account if the address is
new. Returns `{ user, needsProfile }`.

### `POST /api/auth/reset-password` · `PUT /api/auth/reset-password`
Request, then consume. The POST always reports success regardless of whether
the address exists. The PUT revokes every existing session for the account.

### `POST /api/auth/logout`
Deletes the server-side session and clears the cookie.

---

## Session and account

### `GET /api/me`
Returns `{ user: null, status: "unauthenticated" }` with **200** when signed
out — not being logged in is a normal state, not an error. Signed in it also
carries `summary` (loyalty tier, credit, booking counts) and unread counts.

### `PATCH /api/me` — auth
Profile fields and `notificationPreferences`. Language and currency are
validated against the registries rather than stored raw.

### `POST /api/account` — auth
`{ action: "change_email" | "become_owner", … }`. Becoming an owner keeps the
account's history and seeds the owner profile.

### `DELETE /api/account` — auth
Anonymises rather than deleting the row, so bookings, payouts and the other
party's message history stay coherent.

### `PUT /api/account/password` — auth
`{ currentPassword, newPassword }`. Signs out every other device.

---

## Discovery

### `GET /api/search`

| Param | Notes |
| --- | --- |
| `destination` | Destination slug |
| `q` | Free text over title, description, destination, operator, boat type |
| `date` | `YYYY-MM-DD` |
| `days`, `adults`, `children` | Trip length and group |
| `activities`, `boat_types`, `amenities`, `durations`, `departure` | Comma-separated |
| `price_min`, `price_max`, `rating`, `capacity` | Numeric |
| `instant_book`, `free_cancellation` | `true` |
| `trip_type` | `private` \| `shared` |
| `lat`, `lon`, `radius` | Radius search ("near me") |
| `sort` | `recommended` (default) \| `price_asc` \| `price_desc` \| `rating` \| `distance` \| `newest` |
| `page`, `per_page`, `currency` | |

Unrecognised values are dropped rather than erroring, so an old bookmark still
returns sensible results.

Returns `{ charters, facets }` plus metadata: `totalCount`, `availableCount`,
`pageCount`, `destination`, `nextAvailableDates`, `nearbyDestinations`,
`priceBounds`.

### `GET /api/destinations?q=&limit=`
Autocomplete. With no query, returns popular destinations.

### `GET /api/charters/:id`
Full listing: photos, boat spec, grouped amenities, trips with per-trip
availability for the supplied `date`/`adults`/`children`, owner profile,
policies, review statistics. `exactAddress` is `null` unless the viewer owns
the listing or holds a confirmed booking on it.

### `GET /api/charters/:id/availability?from=&days=&guests=`
Day-by-day `available` / `blocked` / `booked` / `closed` / `past`.

### `GET /api/charters/:id/reviews?page=&per_page=&sort=`
`sort` is `newest` \| `highest` \| `lowest`. Returns reviews plus the rating
breakdown.

---

## Booking

### `POST /api/bookings/quote`
```jsonc
{ "charterId", "packageId", "date", "adults", "children", "days",
  "paymentMode": "online_full" | "online_deposit" | "on_arrival",
  "currency", "applyCredit?", "promoDiscount?" }
→ { "breakdown": { "lines": [], "total", "dueNow", "dueOnArrival", "securityDeposit" },
    "available", "reason?", "freeCancellationUntil", "instantBook",
    "loyaltyDiscountPercent", "creditApplied" }
```
Open to signed-out visitors so the listing page can quote before login; loyalty
and credit apply only when there is a session.

### `POST /api/bookings` — auth
Same body plus `departureTime`, `contact`, `messageToOwner?`,
`paymentMethodId?`.

The price is **recomputed server-side** and the client's number ignored.
Availability is re-checked and the calendar days claimed inside the same
synchronous mutation, so two guests racing for the last date cannot both win —
the loser gets **409 `unavailable`**. Instant-book listings return `confirmed`;
others return `pending` and still hold the date.

### `GET /api/bookings?status=&role=` — auth
`status` is `upcoming` \| `pending` \| `completed` \| `cancelled` \| `all`.
`role=owner` switches to bookings taken against the caller's listings. The
scope comes from the session, never from a parameter.

### `GET /api/bookings/:id` — auth
Accepts an ID or a booking reference. Visible only to the guest and the owner.

### `POST /api/bookings/:id` — auth
```jsonc
{ "action": "accept" | "decline" | "cancel", "reason?" }
```
`accept`/`decline` are owner-only. `cancel` works for either party — an owner
cancelling is always a full refund. The response carries `refund`, `forfeited`
and `free`.

---

## Messaging, wishlist, reviews, cards

### `GET /api/inbox` — auth · `POST /api/inbox` — auth
List conversations; open (or reuse) a thread about a listing.

### `GET /api/inbox/:id` — auth
Reads the thread **and marks it read** in one pass.

### `POST /api/inbox/:id` — auth
Send a message. Access is checked on every read and write — a thread ID alone
is never enough.

### `GET /api/wishlist` — auth · `POST /api/wishlist` — auth
List saved listings as search cards; `POST { charterId }` toggles.

### `GET /api/reviews?role=` — auth
Reviews written (or received, with `role=owner`), plus `awaiting` — completed
trips with no review yet.

### `POST /api/reviews` — auth
Create a review (`bookingId`, `headline`, `body`, `ratings`) or an owner
response (`reviewId`, `response`). A review requires a **completed** booking
made by the reviewer, one per booking. Each criterion must be a whole 1–5;
anything else is rejected rather than clamped, so a broken client cannot skew
aggregates quietly.

### `GET|POST|PATCH|DELETE /api/cards` — auth
The full number is validated (Luhn + expiry) and discarded; only brand and last
four are stored. `PATCH { cardId }` promotes to default.

### `GET|POST /api/notifications` — auth
`POST { id }` or `{ all: true }` marks read.

---

## Owner

All **owner**. Ownership is verified in the service layer on every call.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/owner/dashboard` | KPIs, today's trips, pending requests, attention queue |
| `GET|POST /api/owner/listings` | List; create a draft |
| `GET|PATCH|DELETE /api/owner/listings/:id` | Full record; partial update from any editor step; delete |
| `GET|POST|DELETE /api/owner/listings/:id/packages` | Trips. Capacity beyond the boat is rejected. A trip with open bookings is retired, not deleted |
| `POST|PATCH|DELETE /api/owner/listings/:id/photos` | Add, reorder (index 0 is the cover), remove |
| `GET|POST /api/owner/calendar` | Multicalendar; bulk block/unblock. Booked days are skipped, not rejected |
| `GET|POST|DELETE /api/owner/payouts` | Ledger and totals; payout methods |
| `GET|POST|DELETE /api/owner/team` | Team members. The account owner cannot be removed |
| `GET|POST /api/owner/verification` | Documents and status |
| `PATCH /api/owner/settings` | Business profile, online payments |

## Health

### `GET /api/health`
Status, storage driver, and record counts — useful for confirming a fresh
deployment came up with data.

---

## Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `invalid`, `invalid_email`, `weak_password` | 400 | Validation |
| `invalid_credentials` | 401 | Wrong email or password |
| `unauthorized` | 401 | No session |
| `forbidden` | 403 | Session exists, wrong account |
| `not_found`, `charter_not_found`, `package_not_found` | 404 | |
| `email_taken` | 409 | |
| `unavailable` | 409 | Dates taken between quoting and confirming |
| `rate_limited` | 429 | |
| `server_error` | 500 | |
