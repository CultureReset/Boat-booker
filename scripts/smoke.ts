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

  // Find a date this trip can actually run on.
  //
  // The calendar is charter-level: a day is "available" when *any* of the
  // listing's trips can run, and each trip carries its own weekday mask. So an
  // open day is a candidate, not an answer — the quote is what decides, and
  // that is exactly what the booking form does before it enables its button.
  const ownerAvailability = await guest.get<{ days: { date: string; state: string }[] }>(
    `/api/charters/${ownerCharterId}/availability?days=180`,
  );
  const openDays = ownerAvailability.data.days.filter((d) => d.state === 'available');
  check('an open date exists', openDays.length > 0, ownerAvailability.data.days.slice(0, 5));

  const guests = Math.max(pkg.minPersons, 2);
  const payloadFor = (date: string) => ({
    charterId: ownerCharterId,
    packageId: pkg.id,
    date,
    adults: guests,
    children: 0,
    days: 1,
    paymentMode: 'online_deposit',
    currency: 'USD',
  });

  type Quote = {
    available: boolean;
    breakdown: { total: number; dueNow: number; dueOnArrival: number; lines: unknown[] };
  };

  let openDay: { date: string } | undefined;
  let quote!: { status: number; data: Quote; error?: { code: string; message: string } };

  for (const candidate of openDays.slice(0, 30)) {
    const attempt = await customer.post<Quote>('/api/bookings/quote', payloadFor(candidate.date));
    if (attempt.status === 200 && attempt.data?.available) {
      openDay = candidate;
      quote = attempt;
      break;
    }
  }

  check('a bookable date exists for this trip', Boolean(openDay), openDays.slice(0, 5));

  const quotePayload = payloadFor(openDay!.date);
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

  const expiredCard = await customer.post('/api/cards', {
    number: '4242424242424242',
    expMonth: 1,
    expYear: new Date().getFullYear() - 1,
  });
  check('an expired card is rejected', expiredCard.status === 400, expiredCard);

  // ------------------------------------------------------- wallets
  const wallet = await customer.post<{ id: string; kind: string; accountLabel: string }>(
    '/api/cards',
    { kind: 'paypal', accountLabel: 'smoke@example.com' },
  );
  check('a PayPal wallet is saved', wallet.status === 201 && wallet.data?.kind === 'paypal', wallet.error);
  check('the wallet keeps only the account label', wallet.data?.accountLabel === 'smoke@example.com');

  const badWallet = await customer.post('/api/cards', {
    kind: 'paypal',
    accountLabel: 'not-an-address',
  });
  check('a PayPal wallet needs a real address', badWallet.status === 400, badWallet);

  // One wallet per kind: linking again re-points the same one rather than
  // adding a second way to pay through the same account.
  const relinked = await customer.post<{ id: string }>('/api/cards', {
    kind: 'paypal',
    accountLabel: 'smoke2@example.com',
  });
  check('re-linking PayPal updates the same wallet', relinked.data?.id === wallet.data.id, relinked.data);

  const methods = await customer.get<{ id: string; kind: string }[]>('/api/cards');
  check(
    'cards and wallets come back in one list',
    methods.data?.some((m) => m.kind === 'card') && methods.data?.some((m) => m.kind === 'paypal'),
    methods.data?.map((m) => m.kind),
  );

  const promoted = await customer.patch('/api/cards', { methodId: wallet.data.id });
  check('a wallet can be made the default', promoted.status === 200, promoted.error);

  const afterPromote = await customer.get<{ id: string; isDefault: boolean }[]>('/api/cards');
  check(
    'exactly one method is default',
    afterPromote.data?.filter((m) => m.isDefault).length === 1,
    afterPromote.data,
  );

  await customer.del(`/api/cards?id=${wallet.data.id}`);
  const afterRemove = await customer.get<{ id: string; isDefault: boolean }[]>('/api/cards');
  check(
    'removing the default promotes another',
    afterRemove.data?.length === 0 || afterRemove.data.some((m) => m.isDefault),
    afterRemove.data,
  );

  // --------------------------------------------------- phone verification
  section('Phone verification');
  const phoneStatus = await customer.get<{ verified: boolean; cooldownSeconds: number }>(
    '/api/auth/phone',
  );
  check('phone status responds', phoneStatus.status === 200, phoneStatus.error);

  const badNumber = await customer.post('/api/auth/phone', { action: 'send', phone: '123' });
  check('a too-short number is refused', badNumber.status === 400, badNumber);

  const codeSent = await customer.post<{ sent: boolean; code?: string; resendAfterSeconds: number }>(
    '/api/auth/phone',
    { action: 'send', phone: '+1 555 0142' },
  );
  check('a code is sent', codeSent.data?.sent === true, codeSent.error);
  check('the response carries a resend cooldown', (codeSent.data?.resendAfterSeconds ?? 0) > 0);

  const tooSoon = await customer.post('/api/auth/phone', { action: 'send', phone: '+1 555 0142' });
  check('resending inside the cooldown is refused', tooSoon.status === 429, tooSoon);

  const wrongCode = await customer.post('/api/auth/phone', { action: 'verify', code: '000001' });
  check('a wrong code is refused', wrongCode.status === 400, wrongCode);

  // The code is only in the response because this build has no SMS transport;
  // AUTH_EXPOSE_MAGIC_LINK=false removes it, and this assertion with it.
  if (codeSent.data?.code) {
    const verified = await customer.post<{ verified: boolean; user: { phone: string } }>(
      '/api/auth/phone',
      { action: 'verify', code: codeSent.data.code },
    );
    check('the right code verifies', verified.data?.verified === true, verified.error);
    check('the number lands on the account', verified.data?.user?.phone === '+15550142', verified.data?.user);

    const replay = await customer.post('/api/auth/phone', {
      action: 'verify',
      code: codeSent.data.code,
    });
    check('a used code cannot be replayed', replay.status >= 400, replay);
  }

  const profile = await customer.patch<{ user: { bio: string } }>('/api/me', {
    bio: 'Smoke test bio',
    currency: 'EUR',
  });
  check('profile updates', profile.data?.user?.bio === 'Smoke test bio', profile.error);
  await customer.patch('/api/me', { currency: 'USD' });

  // ------------------------------------------------------- change requests
  section('Change requests');
  // A change that moves the price goes to manual review by design, and the
  // booking deliberately stays put until a person confirms it. To exercise the
  // *applied* path the replacement date has to price identically, so quote the
  // candidates and take the first that matches.
  const candidates = afterBooking.data.days
    .filter((d) => d.state === 'available' && d.date !== openDay!.date)
    .map((d) => d.date)
    .slice(0, 20);

  let newDate = '';
  for (const candidate of candidates) {
    const candidateQuote = await customer.post<{ available: boolean; breakdown: { total: number } }>(
      '/api/bookings/quote',
      { ...quotePayload, date: candidate },
    );
    if (
      candidateQuote.data?.available &&
      Math.abs(candidateQuote.data.breakdown.total - quote.data.breakdown.total) < 0.01
    ) {
      newDate = candidate;
      break;
    }
  }
  check('a same-price date exists to move to', Boolean(newDate), candidates.slice(0, 5));

  // A change that moves money must not apply on a tap — it goes to a person.
  // Adding a guest is the cheapest way to move the price on any listing.
  const pricedChange = await customer.post<{
    changeRequest: { id: string; priceDifference: number };
  }>(`/api/bookings/${booking.data.id}`, {
    action: 'request_change',
    requested: { days: 2 },
    note: 'Smoke test — stretching the trip to two days.',
  });
  check('a duration change is priced', pricedChange.status === 200, pricedChange.error);
  check(
    'a second day moves the price',
    (pricedChange.data?.changeRequest?.priceDifference ?? 0) > 0,
    pricedChange.data?.changeRequest,
  );

  const withdrawn = await customer.post<{ booking: { status: string } }>(
    `/api/bookings/${booking.data.id}`,
    { action: 'withdraw_change', changeRequestId: pricedChange.data.changeRequest.id },
  );
  check('the requester can withdraw', withdrawn.status === 200, withdrawn.error);
  check('withdrawing restores the booking', withdrawn.data?.booking?.status === 'confirmed', withdrawn.data?.booking);

  const changeRequested = await customer.post<{
    booking: { status: string };
    changeRequest: { id: string; status: string; priceDifference: number };
  }>(`/api/bookings/${booking.data.id}`, {
    action: 'request_change',
    requested: { date: newDate },
    note: 'Smoke test — moving the trip a day.',
  });
  check('change request is raised', changeRequested.status === 200, changeRequested.error);
  check(
    'booking moves to change_requested',
    changeRequested.data?.booking?.status === 'change_requested',
    changeRequested.data?.booking,
  );

  // The original date must still be held while the change is outstanding —
  // releasing it early would let someone else take it and strand the guest.
  const duringChange = await guest.get<{ days: { date: string; state: string }[] }>(
    `/api/charters/${ownerCharterId}/availability?days=180`,
  );
  check(
    'original date is held during the change',
    duringChange.data.days.find((d) => d.date === openDay!.date)?.state === 'booked',
  );

  check(
    'a same-price change carries no price difference',
    changeRequested.data?.changeRequest?.priceDifference === 0,
    changeRequested.data?.changeRequest,
  );

  const changeAccepted = await owner.post<{
    booking: { status: string; date: string };
    needsSupportReview: boolean;
  }>(`/api/bookings/${booking.data.id}`, {
    action: 'accept_change',
    changeRequestId: changeRequested.data.changeRequest.id,
  });
  check('owner accepts the change', changeAccepted.status === 200, changeAccepted.error);
  check(
    'a same-price change applies without support review',
    changeAccepted.data?.needsSupportReview === false,
    changeAccepted.data,
  );
  check('booking moves to the new date', changeAccepted.data?.booking?.date === newDate, changeAccepted.data?.booking);
  check('booking is confirmed again', changeAccepted.data?.booking?.status === 'confirmed', changeAccepted.data?.booking);

  const afterChange = await guest.get<{ days: { date: string; state: string }[] }>(
    `/api/charters/${ownerCharterId}/availability?days=180`,
  );
  check(
    'old date is released once the new one is secured',
    afterChange.data.days.find((d) => d.date === openDay!.date)?.state === 'available',
  );
  check(
    'new date is now held',
    afterChange.data.days.find((d) => d.date === newDate)?.state === 'booked',
  );

  // ---------------------------------------------------------------- offers
  section('Offers');
  const ownerThreads = await owner.get<
    { id: string; charterId: string; counterparty: { id: string } }[]
  >('/api/inbox');
  // The thread has to be with *this* guest, or the offer lands in someone
  // else's inbox and the assertion below tests nothing.
  const offerThread = ownerThreads.data?.find(
    (t) => t.charterId === ownerCharterId && t.counterparty.id === login.data.user.id,
  );
  check('owner has a conversation with this guest', Boolean(offerThread), ownerThreads.error);

  const offerDate = candidates.find((d) => d !== newDate) ?? candidates[0];
  const offer = await owner.post<{ id: string; status: string; expiresAt: string; price: number }>(
    '/api/offers',
    {
      threadId: offerThread!.id,
      packageId: pkg.id,
      date: offerDate,
      departureTime: pkg.departureTimes[0],
      adults: guests,
      children: 0,
      days: 1,
      price: Math.round(quote.data.breakdown.total * 0.85),
    },
  );
  check('offer is created', offer.status === 201, offer.error);
  check('offer starts as sent', offer.data?.status === 'sent', offer.data);

  // An outstanding offer does not hold the date — availability is re-checked
  // when the guest accepts, so two offers on one date is not a bug.
  const duringOffer = await guest.get<{ days: { date: string; state: string }[] }>(
    `/api/charters/${ownerCharterId}/availability?days=180`,
  );
  check(
    'an outstanding offer does not hold the date',
    duringOffer.data.days.find((d) => d.date === offerDate)?.state === 'available',
  );

  const secondOffer = await owner.post('/api/offers', {
    threadId: offerThread!.id,
    packageId: pkg.id,
    date: offerDate,
    departureTime: pkg.departureTimes[0],
    adults: guests,
    children: 0,
    days: 1,
    price: 100,
  });
  check('a second offer on the same thread is refused', secondOffer.status >= 400, secondOffer.data);

  const guestOffers = await customer.get<{ id: string; role: string }[]>('/api/offers');
  check('the guest sees the offer', guestOffers.data?.some((o) => o.id === offer.data.id), guestOffers.error);

  const withdrawnOffer = await owner.patch<{ status: string }>('/api/offers', {
    offerId: offer.data.id,
    action: 'withdraw',
  });
  check('offer withdraws', withdrawnOffer.data?.status === 'withdrawn', withdrawnOffer.error);

  // ------------------------------------------------------------- payments
  section('Payments');
  const balanceLink = await customer.post<{ token: string }>('/api/payments', {
    action: 'request_link',
    bookingId: booking.data.id,
  });
  check('balance link is issued', Boolean(balanceLink.data?.token), balanceLink.error);

  const scheduled = await customer.post<{ balance: { collection: string } }>('/api/payments', {
    action: 'schedule',
    bookingId: booking.data.id,
    mode: 'online_anytime',
  });
  check('balance collection can be changed', scheduled.status === 200, scheduled.error);

  const tipTooEarly = await customer.post('/api/payments', {
    action: 'tip',
    bookingId: booking.data.id,
    amount: 25,
  });
  check('tipping before the trip is refused', tipTooEarly.status >= 400, tipTooEarly.data);

  // ---------------------------------------------------------------- social
  section('Social');
  const shared = await customer.post<{ token: string }>('/api/social', { action: 'share_wishlist' });
  check('wishlist shares', Boolean(shared.data?.token), shared.error);

  const revoked = await customer.post<{ revoked: boolean }>('/api/social', {
    action: 'revoke_wishlist',
  });
  check('wishlist share revokes', revoked.data?.revoked === true, revoked.error);

  // -------------------------------------------------------- notifications
  section('Notifications');
  const notifications = await customer.get<{ id: string }[]>('/api/notifications');
  check('notification feed loads', notifications.status === 200, notifications.error);
  check('booking activity produced notifications', (notifications.data?.length ?? 0) > 0, notifications.data);

  const readAll = await customer.post<{ marked: number }>('/api/notifications', { all: true });
  check('notifications mark read', readAll.status === 200, readAll.error);
  check('marking read reports a count', typeof readAll.data?.marked === 'number', readAll.data);

  // ---------------------------------------------------------- cancellation
  section('Cancellation');

  // The preview must not mutate: it is what the cancel screen shows before the
  // guest has decided anything.
  const preview = await customer.post<{ refund: number; free: boolean }>(
    `/api/bookings/${booking.data.id}`,
    { action: 'preview_cancel', reason: 'plans_changed' },
  );
  check('cancellation preview responds', preview.status === 200, preview.error);

  const stillLive = await customer.get<{ status: string }>(`/api/bookings/${booking.data.id}`);
  check('preview did not cancel the booking', stillLive.data?.status === 'confirmed', stillLive.data);

  const cancelled = await customer.post<{
    booking: { status: string };
    refund: number;
    penalties: unknown[];
  }>(`/api/bookings/${booking.data.id}`, { action: 'cancel', reason: 'plans_changed' });
  check('booking cancels', cancelled.data?.booking?.status === 'cancelled', cancelled.error);
  check('cancellation reports penalties', Array.isArray(cancelled.data?.penalties), cancelled.data);

  const afterCancel = await guest.get<{ days: { date: string; state: string }[] }>(
    `/api/charters/${ownerCharterId}/availability?days=180`,
  );
  // The date the booking ended up on after the change, not the one it started
  // on — that was released when the change was accepted.
  const releasedDay = afterCancel.data.days.find((d) => d.date === newDate);
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

  // -------------------------------------------------- itineraries and extras
  section('Itineraries and add-ons');
  const itinerary = await owner.post<{ id: string; status: string }>(
    `/api/owner/listings/${draft.data.id}/itineraries`,
    {
      action: 'save',
      packageId: trip.data.id,
      days: [
        {
          steps: [
            { title: 'Meet at the dock', description: 'Find the crew at the slip.', minutes: 20 },
            { title: 'Head out', description: 'Run past the breakwater.', minutes: 40 },
          ],
        },
      ],
    },
  );
  check('itinerary saves as a draft', itinerary.status === 200 || itinerary.status === 201, itinerary.error);
  check('a saved itinerary starts as a draft', itinerary.data?.status === 'draft', itinerary.data);

  const published = await owner.post<{ status: string }>(
    `/api/owner/listings/${draft.data.id}/itineraries`,
    { action: 'publish', itineraryId: itinerary.data.id },
  );
  check('itinerary publishes', published.data?.status === 'published', published.error);

  const thinItinerary = await owner.post(`/api/owner/listings/${draft.data.id}/itineraries`, {
    action: 'save',
    packageId: trip.data.id,
    days: [{ steps: [{ title: 'Only step', description: 'Not enough.', minutes: 30 }] }],
  });
  check('an itinerary day below the step minimum is refused', thinItinerary.status === 400, thinItinerary);

  const addOn = await owner.post<{ id: string; price: number }>(
    `/api/owner/listings/${draft.data.id}/add-ons`,
    { title: 'Snorkel kit', description: 'Mask, fins and snorkel.', price: 25, pricing: 'per_person', maxQuantity: 8 },
  );
  check('add-on is created', addOn.status === 200 || addOn.status === 201, addOn.error);

  const addOns = await owner.get<{ id: string }[]>(`/api/owner/listings/${draft.data.id}/add-ons`);
  check('add-on is listed', addOns.data?.some((a) => a.id === addOn.data.id), addOns.error);

  const cleanup = await owner.del(`/api/owner/listings/${draft.data.id}`);
  check('draft listing deletes', cleanup.status === 200, cleanup);

  // --------------------------------------------------------- quick replies
  section('Quick replies');
  const quickReply = await owner.post<{ id: string; title: string }>('/api/owner/quick-replies', {
    title: 'Smoke reply',
    body: 'Hi %customer_name%, yes the %date% is open.',
  });
  check('quick reply saves', quickReply.status === 200 || quickReply.status === 201, quickReply.error);

  const quickReplies = await owner.get<{ replies: { id: string }[]; placeholders: unknown[] }>(
    '/api/owner/quick-replies',
  );
  check('quick reply is listed', quickReplies.data?.replies?.some((q) => q.id === quickReply.data.id));
  check('placeholders are advertised', (quickReplies.data?.placeholders?.length ?? 0) > 0);

  const removedReply = await owner.post('/api/owner/quick-replies', {
    remove: true,
    id: quickReply.data.id,
  });
  check('quick reply deletes', removedReply.status === 200, removedReply.error);

  // ---------------------------------------------------------------- direct
  section('Direct');
  const directOff = await owner.post('/api/owner/direct', { action: 'enable', acceptTerms: false });
  check('Direct cannot be enabled without accepting terms', directOff.status === 400, directOff);

  const directOn = await owner.post<{ enabled: boolean }>('/api/owner/direct', {
    action: 'enable',
    acceptTerms: true,
    feeBearer: 'owner',
  });
  check('Direct enables', directOn.status === 200, directOn.error);

  const invite = await owner.post<{ token: string }>('/api/owner/direct', {
    action: 'invite',
    charterId: ownerCharterId,
    channel: 'qr',
  });
  check('Direct invite is issued', Boolean(invite.data?.token), invite.error);

  const directRevert = await owner.post('/api/owner/direct', { action: 'disable' });
  check('Direct disables', directRevert.status === 200, directRevert.error);

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
