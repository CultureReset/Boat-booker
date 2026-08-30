import { addDays, today, toIsoDate } from '@/lib/core/dates';
import type { Rng } from '@/lib/core/ids';
import { initialAccountHealth } from '@/lib/domain/defaults';
import { ITINERARY_MIN_STEPS_PER_DAY } from '@/lib/domain/types';
import type {
  AddOn,
  Catch,
  Database,
  DirectSettings,
  Itinerary,
  ItineraryStep,
  Offer,
  QuickReply,
  User,
} from '@/lib/domain/types';

/**
 * Seeds the collections the model gained after the first build.
 *
 * Kept apart from `build.ts` because these are all derived from records that
 * file has already created — every function here reads what is in the database
 * and adds to it, rather than generating anything from scratch.
 */

const ADD_ON_TEMPLATES: { title: string; description: string; price: number; pricing: AddOn['pricing'] }[] = [
  { title: 'Onboard lunch', description: 'Sandwiches, fruit and soft drinks prepared the morning of the trip.', price: 22, pricing: 'per_person' },
  { title: 'Photo package', description: 'The captain shoots the day and sends you the full gallery within 48 hours.', price: 85, pricing: 'per_booking' },
  { title: 'Snorkel gear', description: 'Mask, snorkel and fins, sized on the dock.', price: 15, pricing: 'per_person' },
  { title: 'Hotel pickup', description: 'Door-to-dock transfer from anywhere in the resort strip.', price: 40, pricing: 'per_booking' },
  { title: 'Extra hour', description: 'Stay out an hour past the scheduled return, subject to the next booking.', price: 120, pricing: 'per_booking' },
  { title: 'Fishing licence', description: 'Day licence covering everyone on board.', price: 12, pricing: 'per_person' },
];

const ITINERARY_TEMPLATES: { title: string; description: string; minutes: number; meeting?: boolean }[] = [
  { title: 'Meet at the dock', description: 'Find your captain at the slip, run through the safety brief and load your bags.', minutes: 20, meeting: true },
  { title: 'Head out through the channel', description: 'A slow run past the breakwater while the crew gets the boat set up for the day.', minutes: 25 },
  { title: 'First stop', description: 'Anchor in shallow water for swimming, snorkelling or a first drift, depending on conditions.', minutes: 90 },
  { title: 'Lunch at anchor', description: 'Shut the engines down somewhere sheltered and eat with the swim ladder out.', minutes: 60 },
  { title: 'Second spot', description: 'Reposition based on wind and tide — usually the quieter side of the bay.', minutes: 75 },
  { title: 'Return to the marina', description: 'Back at cruising speed, with time to rinse gear before you step off.', minutes: 30 },
];

const QUICK_REPLY_TEMPLATES: { title: string; body: string }[] = [
  {
    title: 'Welcome',
    body: 'Hi {{customer_name}} — thanks for booking with us. Your trip is on {{trip_date}}, departing {{departure_time}}. Shout if you have any questions before then.',
  },
  {
    title: 'What to bring',
    body: 'Hi {{customer_name}}, bring sunscreen, a hat and a soft bag. Towels, cooler ice and all safety gear are already on board.',
  },
  {
    title: 'Meeting point',
    body: 'We meet at the main dock fifteen minutes before {{departure_time}}. Parking is on site — I will be on {{charter_title}}.',
  },
  {
    title: 'Weather watch',
    body: 'Hi {{customer_name}}, keeping an eye on the forecast for {{trip_date}}. I will message you the evening before with a final call.',
  },
];

const CATCH_CAPTIONS = [
  'Water was flat all morning and the bite stayed on until we turned for home.',
  'Kids got their first one within twenty minutes of dropping the anchor.',
  'Slow start, then everything happened at once on the second drift.',
  'Best conditions we have had all season — barely a ripple past the point.',
  'Captain put us right on top of them. Home by two with plenty to show for it.',
];

/**
 * The demo operator's own listings.
 *
 * A coin flip is right for the other 144 listings — a demo where every boat
 * has everything shows nothing about how the product behaves when they do not.
 * But the demo account is what a person actually opens, and an empty Add-ons
 * screen there reads as an unbuilt feature rather than an unused one.
 */
function demoOwnerCharters(db: Database): Set<string> {
  const owner = db.users.find((u) => u.email === 'owner@boatbooker.demo');
  return new Set(db.charters.filter((c) => c.ownerId === owner?.id).map((c) => c.id));
}

/** Trips need somewhere to sell extras, and add-ons need a listing to sit on. */
function seedAddOns(db: Database, rng: Rng, nextId: () => string): void {
  const demo = demoOwnerCharters(db);

  for (const charter of db.charters) {
    if (!demo.has(charter.id) && !rng.bool(0.55)) continue;
    for (const template of rng.sample(ADD_ON_TEMPLATES, rng.int(1, 3))) {
      db.addOns.push({
        id: nextId(),
        charterId: charter.id,
        title: template.title,
        description: template.description,
        price: template.price,
        currency: charter.currency,
        pricing: template.pricing,
        maxQuantity: template.pricing === 'per_person' ? charter.boat.capacity : 1,
        active: true,
      });
    }
  }
}

/**
 * Itineraries on roughly a third of trips.
 *
 * Deliberately mixed: some published, some left in draft below the two-step
 * publish gate, so the opportunities engine has real work to point at.
 */
function seedItineraries(db: Database, rng: Rng, nextId: () => string): void {
  const now = new Date().toISOString();
  const demo = demoOwnerCharters(db);

  for (const pkg of db.packages) {
    const isDemo = demo.has(pkg.charterId);
    if (!isDemo && !rng.bool(0.34)) continue;

    // The demo listing gets one of each, so both the published view and the
    // publish gate are reachable without hunting for a listing that has them.
    const publish = isDemo ? rng.bool(0.5) : rng.bool(0.6);
    const stepCount = publish
      ? rng.int(ITINERARY_MIN_STEPS_PER_DAY + 1, ITINERARY_MIN_STEPS_PER_DAY + 3)
      : 1;

    const steps: ItineraryStep[] = ITINERARY_TEMPLATES.slice(0, stepCount).map((t) => ({
      id: nextId(),
      title: t.title,
      description: t.description,
      durationMinutes: t.minutes,
      isMeetingPoint: Boolean(t.meeting),
    }));

    const itinerary: Itinerary = {
      id: nextId(),
      charterId: pkg.charterId,
      packageId: pkg.id,
      status: publish ? 'published' : 'draft',
      days: [{ steps }],
      createdAt: now,
      updatedAt: now,
      publishedAt: publish ? now : undefined,
    };
    db.itineraries.push(itinerary);
  }
}

/** Every owner gets health, Direct settings and a couple of saved replies. */
function seedOwnerRecords(db: Database, rng: Rng, nextId: () => string): void {
  const owners = db.users.filter((u) => u.role === 'owner');

  for (const owner of owners) {
    const health = initialAccountHealth(owner.id);
    // A realistic spread — most operators are fine, a few are not.
    health.realizationRate = rng.weighted([[0.99, 6], [0.96, 3], [0.88, 1]] as const);
    health.responseRate = rng.weighted([[1, 5], [0.97, 3], [0.82, 1]] as const);
    health.instantBookStrikes = rng.weighted([[0, 8], [1, 2], [3, 1]] as const);
    db.accountHealth.push(health);

    const direct: DirectSettings = {
      ownerId: owner.id,
      enabled: rng.bool(0.25),
      slug: slugForOwner(owner),
      feeBearer: rng.bool(0.4) ? 'customer' : 'operator',
      invitesSent: 0,
    };
    if (direct.enabled) direct.termsAcceptedAt = new Date(Date.now() - 60 * 86_400_000).toISOString();
    db.directSettings.push(direct);

    if (rng.bool(0.4)) {
      const now = new Date().toISOString();
      for (const template of rng.sample(QUICK_REPLY_TEMPLATES, rng.int(1, 3))) {
        const reply: QuickReply = {
          id: nextId(),
          ownerId: owner.id,
          title: template.title,
          body: template.body,
          createdAt: now,
          updatedAt: now,
        };
        db.quickReplies.push(reply);
      }
    }
  }
}

function slugForOwner(owner: User): string {
  const base = (owner.ownerProfile?.companyName ?? `${owner.firstName}-${owner.lastName}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base}-${owner.id.slice(-4)}`;
}

/** The public catches feed, built from trips that already happened. */
function seedCatches(db: Database, rng: Rng, nextId: () => string): void {
  const done = db.bookings.filter((b) => b.status === 'done');

  for (const booking of done) {
    if (!rng.bool(0.3)) continue;
    const charter = db.charters.find((c) => c.id === booking.charterId);
    if (!charter || !charter.photos.length) continue;

    const item: Catch = {
      id: nextId(),
      bookingId: booking.id,
      charterId: charter.id,
      customerId: booking.customerId,
      destinationId: charter.destinationId,
      title: charter.title,
      photo: rng.pick(charter.photos),
      caption: rng.pick(CATCH_CAPTIONS),
      month: Number(booking.date.slice(5, 7)),
      likes: rng.int(0, 140),
      createdAt: new Date(`${booking.date}T18:00:00.000Z`).toISOString(),
    };
    db.catches.push(item);
  }

  db.catches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * A live offer waiting in the demo customer's inbox.
 *
 * Offers are the one part of the messaging product that cannot be inferred from
 * a booking, so the demo needs at least one standing to show the flow.
 */
function seedStandingOffer(db: Database, rng: Rng, nextId: () => string): void {
  const customer = db.users.find((u) => u.email === 'guest@boatbooker.demo');
  const owner = db.users.find((u) => u.email === 'owner@boatbooker.demo');
  if (!customer || !owner) return;

  const charter = db.charters.find((c) => c.ownerId === owner.id);
  const pkg = charter && db.packages.find((p) => p.charterId === charter.id);
  if (!charter || !pkg) return;

  const now = new Date();
  const nowIso = now.toISOString();
  const threadId = nextId();

  db.threads.push({
    id: threadId,
    kind: 'offer',
    customerId: customer.id,
    ownerId: owner.id,
    charterId: charter.id,
    subject: charter.title,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  const offer: Offer = {
    id: nextId(),
    threadId,
    charterId: charter.id,
    ownerId: owner.id,
    customerId: customer.id,
    packageId: pkg.id,
    date: toIsoDate(addDays(today(), 21)),
    departureTime: pkg.departureTimes[0],
    adults: 4,
    children: 0,
    days: 1,
    // Undercuts the list price — that is the point of a custom offer.
    price: Math.round(pkg.price * 0.88),
    currency: charter.currency,
    status: 'sent',
    createdAt: nowIso,
    expiresAt: new Date(now.getTime() + 48 * 3_600_000).toISOString(),
  };
  db.offers.push(offer);
  db.threads[db.threads.length - 1].offerId = offer.id;

  db.messages.push(
    {
      id: nextId(),
      threadId,
      createdAt: nowIso,
      body: '',
      systemEvent: 'offer_sent',
      deliveredAt: nowIso,
    },
    {
      id: nextId(),
      threadId,
      senderId: owner.id,
      body: `I had a cancellation on the ${toIsoDate(addDays(today(), 21))} and would rather run the trip than leave the slip empty. Same boat, same route, ${rng.int(10, 15)}% off the usual price. Offer holds for 48 hours.`,
      createdAt: nowIso,
      deliveredAt: nowIso,
    },
  );
}

/** Populates every collection added after the original build. */
export function extendSeed(db: Database, rng: Rng, nextId: () => string): void {
  seedAddOns(db, rng, nextId);
  seedItineraries(db, rng, nextId);
  seedOwnerRecords(db, rng, nextId);
  seedCatches(db, rng, nextId);
  seedStandingOffer(db, rng, nextId);
}
