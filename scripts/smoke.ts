/**
 * End-to-end smoke test.
 *
 * Drives the public API the way the UI does — search, listing, quote, book,
 * owner accept, message, cancel, review — against a running dev or production
 * server. Run with `npm run smoke` while the app is up.
 *
 * Exits non-zero on the first failure so it can gate a deploy.
 */

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';

let passed = 0;
let failed = 0;

function check(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 300)}`}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/** Cookie jar so a session survives across calls, like a browser. */
class Client {
  private cookies = new Map<string, string>();

  private cookieHeader(): string {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private capture(response: Response): void {
    // Node exposes multiple Set-Cookie headers through getSetCookie().
    const raw = (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const line of raw) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  async call<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; data: T; error?: { code: string; message: string } }> {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(this.cookies.size ? { cookie: this.cookieHeader() } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    this.capture(response);

    const payload = (await response.json().catch(() => ({}))) as {
      data?: T;
      error?: { code: string; message: string };
      metadata?: unknown;
    };

    return { status: response.status, data: payload.data as T, error: payload.error };
  }

  get = <T>(path: string) => this.call<T>('GET', path);
  post = <T>(path: string, body: unknown) => this.call<T>('POST', path, body);
  patch = <T>(path: string, body: unknown) => this.call<T>('PATCH', path, body);
  del = <T>(path: string) => this.call<T>('DELETE', path);
}

async function main(): Promise<void> {
  console.log(`Smoke testing ${BASE}`);

  const guest = new Client();

  // ---------------------------------------------------------------- health
  section('Health and catalogue');
  const health = await guest.get<{ status: string; counts: Record<string, number> }>('/api/health');
  check('health responds', health.status === 200 && health.data?.status === 'ok', health);
  check('listings are seeded', (health.data?.counts.charters ?? 0) > 20, health.data?.counts);

  // ---------------------------------------------------------------- search
  section('Search');
  const search = await guest.get<{ charters: { id: string; title: string; minPrice: unknown }[]; facets: unknown[] }>(
    '/api/search?adults=2&per_page=12',
  );
  check('search returns results', (search.data?.charters?.length ?? 0) > 0, search.error);
  check('search returns facets', (search.data?.facets?.length ?? 0) > 0);
  check('cards carry a price', Boolean(search.data?.charters?.[0]?.minPrice));

  const filtered = await guest.get<{ charters: unknown[] }>(
    '/api/search?instant_book=true&free_cancellation=true&per_page=6',
  );
  check('filtered search responds', filtered.status === 200, filtered.error);

  const sorted = await guest.get<{ charters: { minPrice: { value: number } | null }[] }>(
    '/api/search?sort=price_asc&per_page=10',
  );
  const prices = (sorted.data?.charters ?? []).map((c) => c.minPrice?.value ?? Infinity);
  check(
    'price sort is ascending',
    prices.every((p, i) => i === 0 || prices[i - 1] <= p),
    prices,
  );

  const suggestions = await guest.get<unknown[]>('/api/destinations?q=mia');
  check('destination autocomplete works', (suggestions.data?.length ?? 0) > 0);

  // ---------------------------------------------------------------- listing
  section('Listing detail');
  const charterId = search.data.charters[0].id;
  const listing = await guest.get<{
    id: string;
    packages: { id: string; capacity: number; minPersons: number; departureTimes: string[] }[];
    exactAddress: string | null;
    owner: { displayName: string };
  }>(`/api/charters/${charterId}?adults=2`);

  check('listing loads', listing.status === 200 && listing.data?.id === charterId, listing.error);
  check('listing has trips', (listing.data?.packages?.length ?? 0) > 0);
  check('exact address hidden from strangers', listing.data?.exactAddress === null);
  check('owner profile present', Boolean(listing.data?.owner?.displayName));

  const availability = await guest.get<{ days: { date: string; state: string }[] }>(
    `/api/charters/${charterId}/availability?days=60`,
  );
  check('availability calendar loads', (availability.data?.days?.length ?? 0) === 60);

  const reviews = await guest.get<{ reviews: unknown[]; statistics: { reviewCount: number } }>(
    `/api/charters/${charterId}/reviews`,
  );
  check('reviews endpoint responds', reviews.status === 200, reviews.error);

  // ---------------------------------------------------------------- auth
  section('Authentication');
  const badLogin = await guest.post('/api/auth/login', {
    email: 'guest@boatbooker.demo',
    password: 'wrong-password',
  });
  check('bad password is rejected', badLogin.status === 401, badLogin);

  const customer = new Client();
  const login = await customer.post<{ user: { id: string; email: string } }>('/api/auth/login', {
    email: 'guest@boatbooker.demo',
    password: 'Password123',
  });
  check('demo customer logs in', login.status === 200 && Boolean(login.data?.user?.id), login.error);

  const me = await customer.get<{ user: { email: string } | null; summary: unknown }>('/api/me');
  check('session resolves', me.data?.user?.email === 'guest@boatbooker.demo', me.data);
  check('account summary present', Boolean(me.data?.summary));

  const anonMe = await guest.get<{ user: unknown }>('/api/me');
  check('signed-out /api/me is 200 with null user', anonMe.status === 200 && anonMe.data?.user === null);

  // ---------------------------------------------------------------- booking
  section('Booking flow');
  const owner = new Client();
  const ownerLogin = await owner.post<{ user: { id: string } }>('/api/auth/login', {
    email: 'owner@boatbooker.demo',
    password: 'Password123',
  });
  check('demo owner logs in', ownerLogin.status === 200, ownerLogin.error);

  const ownerListings = await owner.get<{ id: string; title: string }[]>('/api/owner/listings');
  check('owner sees their listings', (ownerListings.data?.length ?? 0) > 0, ownerListings.error);

  const ownerCharterId = ownerListings.data[0].id;
  const ownerCharter = await guest.get<{
    packages: { id: string; capacity: number; minPersons: number; departureTimes: string[] }[];
  }>(`/api/charters/${ownerCharterId}`);
  const pkg = ownerCharter.data.packages[0];
  check('owner listing has a bookable trip', Boolean(pkg));

  // Find a date the calendar actually reports as open.
  const ownerAvailability = await guest.get<{ days: { date: string; state: string }[] }>(
    `/api/charters/${ownerCharterId}/availability?days=180`,
  );
  const openDay = ownerAvailability.data.days.find((d) => d.state === 'available');
  check('an open date exists', Boolean(openDay), ownerAvailability.data.days.slice(0, 5));

  const guests = Math.max(pkg.minPersons, 2);
  const quotePayload = {
    charterId: ownerCharterId,
    packageId: pkg.id,
    date: openDay!.date,
    adults: guests,
    children: 0,
    days: 1,
    paymentMode: 'online_deposit',
    currency: 'USD',
  };

  const quote = await customer.post<{
    available: boolean;
    breakdown: { total: number; dueNow: number; dueOnArrival: number; lines: unknown[] };
  }>('/api/bookings/quote', quotePayload);
  check('quote succeeds', quote.status === 200, quote.error);
  check('quote is available', quote.data?.available === true, quote.data);
  check('quote has a positive total', (quote.data?.breakdown?.total ?? 0) > 0, quote.data?.breakdown);
  check(
    'deposit split adds up to the total',
    Math.abs(
      (quote.data.breakdown.dueNow + quote.data.breakdown.dueOnArrival) - quote.data.breakdown.total,
    ) < 0.01,
    quote.data.breakdown,
  );

  const booking = await customer.post<{ id: string; reference: string; status: string; breakdown: { total: number } }>(
    '/api/bookings',
    {
      ...quotePayload,
      departureTime: pkg.departureTimes[0],
      messageToOwner: 'Smoke test booking — celebrating a birthday.',
      contact: { firstName: 'Alex', lastName: 'Rivera', email: 'guest@boatbooker.demo', phone: '+1 555 0100' },
    },
  );
  check('booking is created', booking.status === 201, booking.error);
  check('booking has a reference', Boolean(booking.data?.reference), booking.data);
  check(
    'server price matches the quote',
    Math.abs(booking.data.breakdown.total - quote.data.breakdown.total) < 0.01,
  );

  // The date the booking claimed must no longer be open.
  const afterBooking = await guest.get<{ days: { date: string; state: string }[] }>(
    `/api/charters/${ownerCharterId}/availability?days=180`,
  );
  const claimedDay = afterBooking.data.days.find((d) => d.date === openDay!.date);
  check('booked date is no longer available', claimedDay?.state === 'booked', claimedDay);

  // Double-booking the same date must be refused.
  const conflict = await customer.post('/api/bookings', {
    ...quotePayload,
    departureTime: pkg.departureTimes[0],
    contact: { firstName: 'Alex', lastName: 'Rivera', email: 'guest@boatbooker.demo', phone: '+1 555 0100' },
  });
  check('double booking is refused', conflict.status === 409, conflict);

  // ------------------------------------------------------- owner response
  section('Owner response');
  const ownerBookings = await owner.get<{ id: string; status: string }[]>('/api/bookings?role=owner');
  check('owner sees the booking', ownerBookings.data?.some((b) => b.id === booking.data.id), ownerBookings.error);

  const created = ownerBookings.data.find((b) => b.id === booking.data.id);
  if (created?.status === 'pending') {
    const accepted = await owner.post<{ booking: { status: string } }>(`/api/bookings/${booking.data.id}`, {
      action: 'accept',
    });
    check('owner accepts the request', accepted.data?.booking?.status === 'confirmed', accepted.error);
  } else {
    check('instant-book listing confirmed immediately', created?.status === 'confirmed', created);
  }

  // A third party must not be able to read someone else's booking.
  const stranger = new Client();
  const peek = await stranger.get(`/api/bookings/${booking.data.id}`);
  check('signed-out user cannot read a booking', peek.status === 401, peek);

  // ---------------------------------------------------------------- inbox
  section('Messaging');
  const threads = await customer.get<{ id: string; unreadCount: number }[]>('/api/inbox');
  check('customer has conversations', (threads.data?.length ?? 0) > 0, threads.error);

  const threadId = threads.data[0].id;
  const sent = await customer.post<{ messages: unknown[] }>(`/api/inbox/${threadId}`, {
    body: 'Smoke test message.',
  });
  check('message sends', sent.status === 201, sent.error);

  const strangerThread = await stranger.get(`/api/inbox/${threadId}`);
  check('conversation is private', strangerThread.status === 401, strangerThread);

  // ---------------------------------------------------------------- wishlist
  section('Wishlist and account');
  const saved = await customer.post<{ saved: boolean }>('/api/wishlist', { charterId });
  check('listing is saved', saved.data?.saved === true, saved.error);

  const wishlist = await customer.get<{ id: string }[]>('/api/wishlist');
  check('wishlist contains it', wishlist.data?.some((c) => c.id === charterId));

  const unsaved = await customer.post<{ saved: boolean }>('/api/wishlist', { charterId });
  check('listing toggles off', unsaved.data?.saved === false);

  const card = await customer.post<{ last4: string; brand: string }>('/api/cards', {
    number: '4242424242424242',
    expMonth: 12,
    expYear: new Date().getFullYear() + 2,
  });
  check('card is stored', card.status === 201 && card.data?.last4 === '4242', card.error);

  const badCard = await customer.post('/api/cards', {
    number: '4242424242424241',
    expMonth: 12,
    expYear: new Date().getFullYear() + 2,
  });
  check('invalid card number is rejected', badCard.status === 400, badCard);

  const profile = await customer.patch<{ user: { bio: string } }>('/api/me', {
    bio: 'Smoke test bio',
    currency: 'EUR',
  });
  check('profile updates', profile.data?.user?.bio === 'Smoke test bio', profile.error);
  await customer.patch('/api/me', { currency: 'USD' });

  // ---------------------------------------------------------- cancellation
  section('Cancellation');
  const cancelled = await customer.post<{ booking: { status: string }; refund: number }>(
    `/api/bookings/${booking.data.id}`,
    { action: 'cancel', reason: 'Smoke test cleanup' },
  );
  check('booking cancels', cancelled.data?.booking?.status === 'cancelled', cancelled.error);

  const afterCancel = await guest.get<{ days: { date: string; state: string }[] }>(
    `/api/charters/${ownerCharterId}/availability?days=180`,
  );
  const releasedDay = afterCancel.data.days.find((d) => d.date === openDay!.date);
  check('cancelled date is released', releasedDay?.state === 'available', releasedDay);

  // ---------------------------------------------------------------- owner
  section('Owner dashboard');
  const dashboard = await owner.get<{ stats: { totalListings: number }; needsAttention: unknown[] }>(
    '/api/owner/dashboard',
  );
  check('dashboard loads', dashboard.status === 200 && Boolean(dashboard.data?.stats), dashboard.error);

  const payouts = await owner.get<{ totals: { currency: string }; rows: unknown[] }>('/api/owner/payouts');
  check('payout ledger loads', payouts.status === 200 && Boolean(payouts.data?.totals), payouts.error);

  const calendar = await owner.get<{ charterId: string; cells: unknown[] }[]>('/api/owner/calendar?days=30');
  check('multicalendar loads', (calendar.data?.length ?? 0) > 0, calendar.error);

  const customerHitsOwnerApi = await customer.get('/api/owner/dashboard');
  check('customers cannot reach owner endpoints', customerHitsOwnerApi.status === 403, customerHitsOwnerApi);

  // Owner cannot edit a listing that is not theirs.
  const foreign = search.data.charters.find((c) => c.id !== ownerCharterId);
  if (foreign) {
    const forbidden = await owner.patch(`/api/owner/listings/${foreign.id}`, { title: 'Hijacked' });
    check("owner cannot edit another owner's listing", forbidden.status === 403 || forbidden.status === 404, forbidden);
  }

  // ------------------------------------------------------- listing editor
  section('Listing editor');
  const draft = await owner.post<{ id: string }>('/api/owner/listings', {
    title: 'Smoke Test Listing',
    destinationSlug: 'miami',
  });
  check('draft listing is created', draft.status === 201, draft.error);

  const edited = await owner.patch<{ title: string; completeness: number }>(
    `/api/owner/listings/${draft.data.id}`,
    {
      title: 'Smoke Test Listing (edited)',
      longDescription: 'A'.repeat(220),
      boat: { capacity: 8, length: 30 },
      amenities: { wifi: true, ac: true },
      activitySlugs: ['boat-yacht-tours'],
      policies: { isInstantBookActive: true, freeCancellationDaysInAdvance: 5 },
    },
  );
  check('listing updates', edited.data?.title === 'Smoke Test Listing (edited)', edited.error);

  const trip = await owner.post<{ id: string; durationCategory: string }>(
    `/api/owner/listings/${draft.data.id}/packages`,
    { title: '4 Hour Test Trip', hours: 4, price: 600, capacity: 8, minPersons: 1, departureTimes: ['09:00'] },
  );
  check('trip is created', trip.status === 201, trip.error);
  check('duration is categorised', trip.data?.durationCategory === '3_6', trip.data);

  const overCapacity = await owner.post(`/api/owner/listings/${draft.data.id}/packages`, {
    title: 'Too many guests',
    hours: 4,
    price: 600,
    capacity: 99,
    departureTimes: ['09:00'],
  });
  check('capacity beyond the boat is rejected', overCapacity.status === 400, overCapacity);

  const blocked = await owner.post<{ changed: number }>('/api/owner/calendar', {
    charterId: draft.data.id,
    dates: ['2027-06-01', '2027-06-02'],
    blocked: true,
  });
  check('dates block', blocked.data?.changed === 2, blocked.error);

  const cleanup = await owner.del(`/api/owner/listings/${draft.data.id}`);
  check('draft listing deletes', cleanup.status === 200, cleanup);

  // ---------------------------------------------------------------- logout
  section('Logout');
  await customer.post('/api/auth/logout', {});
  const afterLogout = await customer.get<{ user: unknown }>('/api/me');
  check('session is revoked', afterLogout.data?.user === null, afterLogout.data);

  // ---------------------------------------------------------------- result
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('\nSmoke run crashed:', error);
  process.exit(1);
});
