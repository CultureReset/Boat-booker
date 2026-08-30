import { commerceConfig } from '@/config/brand';
import {
  activities,
  amenities,
  boatTypes,
  departureWindows,
  durationCategoryFor,
  paymentMethods,
  type Activity,
} from '@/config/taxonomy';
import { WEEKDAY_MASK_ALL, addDays, maskFromWeekdays, today, toIsoDate } from '@/lib/core/dates';
import { createRng, newBookingReference, type Rng } from '@/lib/core/ids';
import { roundMoney } from '@/lib/core/money';
import { hashPassword } from '@/lib/auth/password';
import { bookingExtras, defaultPolicyExtras } from '@/lib/domain/defaults';
import {
  emptyDatabase,
  type AvailabilityBlock,
  type Booking,
  type Charter,
  type Database,
  type Destination,
  type Message,
  type MessageThread,
  type Payout,
  type Photo,
  type Review,
  type TripPackage,
  type User,
} from '@/lib/domain/types';
import { extendSeed } from './extend';
import { seedCountries, seedDestinations, seedStates } from './geography';
import { computeBreakdown } from '@/lib/services/pricing';

/**
 * Deterministic fixture generator.
 *
 * Everything is derived from a single seed so listing IDs, prices and
 * availability are stable across restarts — bookmarked URLs keep working and
 * the demo looks the same on every machine. Content is generated from the
 * taxonomy config, so adding an activity or amenity immediately shows up in
 * seeded listings without editing this file.
 */

const SEED = Number(process.env.SEED_VALUE ?? 20260830);

const CAPTAIN_FIRST = ['James', 'Maria', 'Nikos', 'Ana', 'Tom', 'Elena', 'Carlos', 'Sofia', 'Liam', 'Priya', 'Marco', 'Hana', 'Owen', 'Isabel', 'Dimitri', 'Grace', 'Felix', 'Nadia', 'Ruben', 'Clara'];
const CAPTAIN_LAST = ['Murphy', 'Alvarez', 'Papadakis', 'Silva', 'Whitfield', 'Kovac', 'Mendez', 'Rossi', 'O’Connell', 'Nair', 'Bianchi', 'Tanaka', 'Bennett', 'Ferreira', 'Petrov', 'Okafor', 'Lindqvist', 'Haddad', 'Costa', 'Duarte'];
const CUSTOMER_FIRST = ['Alex', 'Jordan', 'Sam', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Jamie', 'Avery', 'Quinn', 'Drew', 'Reese', 'Emerson', 'Skyler', 'Rowan', 'Devon'];
const CUSTOMER_LAST = ['Nguyen', 'Baker', 'Hughes', 'Fletcher', 'Ramirez', 'Adeyemi', 'Kowalski', 'Chen', 'Mbeki', 'Sorensen', 'Iqbal', 'Bright', 'Delacroix', 'Novak', 'Watanabe', 'Owens'];

const BOAT_NAMES = ['Sea Breeze', 'Blue Horizon', 'Salt & Sky', 'Nauti Buoy', 'Second Wind', 'Wave Dancer', 'Reel Escape', 'Sundowner', 'Liberty', 'Aquaholic', 'Knot Working', 'Serenity', 'Tide Runner', 'Marlin', 'Compass Rose', 'Southern Cross', 'Odyssey', 'Windward', 'Halcyon', 'Pelican', 'Osprey', 'Meridian', 'Kingfisher', 'Vela', 'Corsair', 'Tramontana', 'Zephyr', 'Calypso', 'Nereid', 'Sirocco'];

const COMPANY_SUFFIX = ['Charters', 'Boat Tours', 'Watersports', 'Sailing Co.', 'Marine', 'Adventures', 'Cruises', 'Expeditions'];

const MANUFACTURERS = [
  { name: 'Sea Ray', models: ['340 Sundancer', 'SLX 280', 'Sundeck 270'] },
  { name: 'Boston Whaler', models: ['280 Outrage', '230 Vantage', '270 Dauntless'] },
  { name: 'Beneteau', models: ['Oceanis 46', 'Antares 11', 'Flyer 9'] },
  { name: 'Lagoon', models: ['42', '450F', '380'] },
  { name: 'Bénéteau', models: ['Swift Trawler 35', 'Gran Turismo 32'] },
  { name: 'Bertram', models: ['35 Sportfish', '31 Flybridge'] },
  { name: 'Grady-White', models: ['Freedom 285', 'Canyon 306'] },
  { name: 'Bennington', models: ['22 SSBX', '25 QSB'] },
  { name: 'Axopar', models: ['28 Cabin', '37 Sun Top'] },
  { name: 'Jeanneau', models: ['Sun Odyssey 410', 'Merry Fisher 895'] },
];

const REVIEW_HEADLINES = [
  'Best day of the trip',
  'Exactly what we wanted',
  'Great captain, great boat',
  'Would book again tomorrow',
  'Perfect for our group',
  'Smooth from start to finish',
  'Worth every penny',
  'Better than we expected',
  'Lovely afternoon on the water',
  'Well organised and relaxed',
];

const REVIEW_BODIES = [
  'Captain met us early, walked us through the safety brief and had cold drinks on ice before we left the dock. Water was calm the whole way out and we got a solid two hours at the sandbar.',
  'Boat was spotless and exactly as pictured. We had four adults and two kids and there was plenty of room. The captain was patient with the kids and let them steer for a bit.',
  'Booked this for a birthday and it delivered. Speakers worked well, plenty of shade under the bimini, and the route took in more than we expected for a half day.',
  'Communication before the trip was quick and clear. Meeting point was easy to find and we left on time. Would recommend to anyone who has not done this before.',
  'Sea was choppier than forecast so the captain changed the route to stay in the lee. Glad he did — we still got everything we wanted without anyone feeling ill.',
  'Great value. The photos do not quite do the boat justice; it is newer and better kept than most of what we looked at in the same price range.',
  'Second time booking with this operator and it was as good as the first. They remembered we do not drink and had extra soft drinks on board without being asked.',
  'Snorkel gear was in good condition and there was enough for everyone. Captain knew exactly where the fish were and gave us plenty of time in the water.',
  'Straightforward, professional and friendly. Nothing dramatic to report, which is exactly what you want from a boat trip.',
  'The sunset timing was perfect. We were anchored in the right spot ten minutes before it dropped and stayed until it was properly dark.',
];

const MESSAGE_SNIPPETS = [
  'Hi — is the boat available on the 14th for a group of six?',
  'Yes, the 14th is open. Morning departure at 9am works best for the tide.',
  'Great. Do you provide towels, or should we bring our own?',
  'We supply towels and cooler ice. Bring sunscreen and a soft bag if you can.',
  'One of our group is vegetarian — is that a problem for the lunch stop?',
  'Not at all, I will let the kitchen know when I confirm the booking.',
];

function buildPhoto(rng: Rng, charterKey: string, index: number, altText: string): Photo {
  // Photos are represented as deterministic gradients rather than remote
  // bitmaps so the demo has no external image dependency and renders offline.
  const hue = (rng.int(180, 230) + index * 9) % 360;
  const hue2 = (hue + rng.int(20, 60)) % 360;
  return {
    id: `${charterKey}_p${index}`,
    url: '',
    placeholder: `linear-gradient(${rng.int(120, 220)}deg, hsl(${hue} 62% ${rng.int(38, 56)}%), hsl(${hue2} 58% ${rng.int(58, 76)}%))`,
    altText,
    width: 1600,
    height: 1067,
    cardinal: index,
  };
}

function pickBoatType(rng: Rng, activityKeys: string[]) {
  const wantsFishing = activityKeys.includes('fishingCharter');
  const pool = wantsFishing
    ? boatTypes.filter((b) => b.category === 'Fishing boats')
    : boatTypes.filter((b) => b.category !== 'Fishing boats' && b.category !== 'Paddle');
  return rng.pick(pool.length ? pool : boatTypes);
}

function buildAmenities(rng: Rng, activityKeys: string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const amenity of amenities) {
    // Rules default to permissive; equipment is sparser so listings differ.
    if (amenity.group === 'rules') {
      out[amenity.key] = rng.bool(amenity.key === 'pets' || amenity.key === 'smoking' ? 0.2 : 0.7);
      continue;
    }
    if (amenity.group === 'fishing-gear') {
      out[amenity.key] = activityKeys.includes('fishingCharter') ? rng.bool(0.8) : rng.bool(0.1);
      continue;
    }
    if (amenity.group === 'water-toys') {
      out[amenity.key] = rng.bool(0.3);
      continue;
    }
    out[amenity.key] = rng.bool(0.55);
  }
  // Anything advertised as an activity must actually be equipped for it.
  if (activityKeys.includes('paddleboardActivity')) out.paddleboard = true;
  if (activityKeys.includes('canoeKayakTours')) out.kayak = true;
  if (activityKeys.includes('snorkelingDivingTours')) out.snorkelingEquipment = true;
  if (activityKeys.includes('jetSkiTours')) out.jetSki = true;
  out.lifeJackets = true;
  out.anchor = true;
  return out;
}

function activityPoolFor(rng: Rng): Activity[] {
  const primary = rng.weighted([
    [activities.filter((a) => a.group === 'tours'), 5],
    [activities.filter((a) => a.group === 'water-sports'), 2],
    [activities.filter((a) => a.group === 'wildlife'), 2],
    [activities.filter((a) => a.group === 'fishing'), 2],
  ] as const);
  const extras = rng.sample(activities, rng.int(1, 4));
  const chosen = [rng.pick(primary), ...extras];
  return Array.from(new Map(chosen.map((a) => [a.key, a])).values());
}

function buildPackages(rng: Rng, charter: Charter, nextId: () => string): TripPackage[] {
  const count = rng.int(2, 4);
  const out: TripPackage[] = [];
  const shapes = rng.sample(
    [
      { hours: 2, label: 'Sightseeing Cruise' },
      { hours: 3, label: 'Harbor Tour' },
      { hours: 4, label: 'Half Day Trip' },
      { hours: 5, label: 'Snorkel & Swim' },
      { hours: 6, label: 'Sunset Tour' },
      { hours: 8, label: 'Full Day Charter' },
      { hours: 10, label: 'Island Hopping Day' },
    ],
    count,
  );

  for (const shape of shapes) {
    const shared = rng.bool(0.25);
    const capacity = shared ? charter.boat.capacity : Math.min(charter.boat.capacity, rng.int(4, charter.boat.capacity));
    const hourlyRate = rng.int(85, 260);
    const basePrice = shared
      ? roundMoney(rng.int(45, 160), charter.currency)
      : roundMoney(hourlyRate * shape.hours, charter.currency);
    const additionalPersonAfter = !shared && rng.bool(0.45) ? rng.int(2, Math.max(2, capacity - 2)) : null;

    out.push({
      id: nextId(),
      charterId: charter.id,
      title: `${shape.hours} Hour – ${shape.label}`,
      hours: shape.hours,
      durationCategory: durationCategoryFor(shape.hours),
      type: shared ? 'shared' : 'private',
      price: basePrice,
      currency: charter.currency,
      capacity,
      minPersons: shared ? rng.int(1, 2) : 1,
      additionalPersonAfter,
      additionalPersonPrice: additionalPersonAfter ? roundMoney(rng.int(25, 90), charter.currency) : null,
      departureTimes: rng
        .sample(departureWindows, rng.int(1, 3))
        .map((w) => w.from)
        .sort(),
      weekdayMask: rng.bool(0.75) ? WEEKDAY_MASK_ALL : maskFromWeekdays(rng.sample([1, 2, 3, 4, 5, 6, 7], rng.int(4, 6))),
      minDays: null,
      active: true,
    });
  }

  return out.sort((a, b) => a.hours - b.hours);
}

export function buildSeed(): Database {
  const rng = createRng(SEED);
  const db = emptyDatabase();

  let idCounter = 1000;
  const nextId = () => String((idCounter += 1));

  // ---- Geography -----------------------------------------------------------
  const countryIdByCode = new Map<string, string>();
  for (const country of seedCountries) {
    const id = nextId();
    countryIdByCode.set(country.code, id);
    db.countries.push({
      id,
      code: country.code,
      title: country.title,
      phoneCode: country.phoneCode,
      continent: country.continent,
    });
  }

  const stateIdByKey = new Map<string, string>();
  for (const state of seedStates) {
    const id = nextId();
    stateIdByKey.set(`${state.countryCode}:${state.abbrev}`, id);
    db.states.push({
      id,
      countryId: countryIdByCode.get(state.countryCode)!,
      abbrev: state.abbrev,
      title: state.title,
    });
  }

  const destinations: Destination[] = seedDestinations.map((d, index) => ({
    id: nextId(),
    slug: d.slug,
    title: d.title,
    countryId: countryIdByCode.get(d.countryCode)!,
    stateId: d.stateAbbrev ? stateIdByKey.get(`${d.countryCode}:${d.stateAbbrev}`) : undefined,
    geoPoint: { lat: d.lat, lon: d.lon },
    timezone: d.timezone,
    blurb: d.blurb,
    heroPhoto: buildPhoto(rng, `dest_${d.slug}`, index, `${d.title} waterfront`),
    popular: d.popular,
  }));
  db.destinations = destinations;

  // ---- Demo accounts -------------------------------------------------------
  // Fixed credentials so every flow in the app can be exercised immediately.
  const demoCustomer = makeUser({
    id: nextId(),
    email: 'guest@boatbooker.demo',
    password: 'Password123',
    firstName: 'Alex',
    lastName: 'Rivera',
    role: 'customer',
    rng,
  });
  demoCustomer.completedTrips = 4;
  demoCustomer.creditBalance = 50;
  db.users.push(demoCustomer);

  // ---- Owners and listings -------------------------------------------------
  const charters: Charter[] = [];
  const packages: TripPackage[] = [];

  const totalWeight = seedDestinations.reduce((sum, d) => sum + d.weight, 0);
  let ownerIndex = 0;

  for (const [destIndex, seedDest] of seedDestinations.entries()) {
    const destination = destinations[destIndex];
    const listingCount = Math.max(3, Math.round((seedDest.weight / totalWeight) * 140));

    for (let i = 0; i < listingCount; i += 1) {
      const first = CAPTAIN_FIRST[ownerIndex % CAPTAIN_FIRST.length];
      const last = CAPTAIN_LAST[Math.floor(ownerIndex / CAPTAIN_FIRST.length) % CAPTAIN_LAST.length];
      const boatName = BOAT_NAMES[(ownerIndex * 7) % BOAT_NAMES.length];
      const companyName = `${boatName} ${rng.pick(COMPANY_SUFFIX)}`;

      const owner = makeUser({
        id: nextId(),
        // First owner gets a memorable address for the demo dashboard.
        email: ownerIndex === 0 ? 'owner@boatbooker.demo' : `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}.${ownerIndex}@owner.boatbooker.demo`,
        password: ownerIndex === 0 ? 'Password123' : undefined,
        firstName: first,
        lastName: last,
        role: 'owner',
        rng,
      });

      const yearStarted = rng.int(2006, 2024);
      owner.ownerProfile = {
        companyName,
        captainName: `${first} ${last}`,
        captainType: rng.bool(0.7) ? 'captain' : 'company',
        background: `${first} has run trips out of ${destination.title} since ${yearStarted}. ${rng.pick([
          'Grew up on this water and knows where to go when the wind turns.',
          'Came to it after twenty years in commercial fishing.',
          'Runs the boat with family, and it shows in how the day is organised.',
          'Started with one boat and a weekend job; now it is the whole week.',
        ])}`,
        experience: `${new Date().getFullYear() - yearStarted} years running charters`,
        languages: rng.pick(['English', 'English, Spanish', 'English, Greek', 'English, Italian', 'English, French']),
        nationality: undefined,
        yearStartedRunningCharters: yearStarted,
        verification: {
          status: rng.weighted([['verified', 5], ['pending', 1], ['unverified', 2]] as const),
          documents: [],
        },
        payoutMethods: [],
        team: [],
        onlinePaymentsEnabled: rng.bool(0.6),
        responseRate: rng.int(78, 100),
        averageResponseTimeSeconds: rng.int(600, 43200),
      };
      db.users.push(owner);

      const activityList = activityPoolFor(rng);
      const activityKeys = activityList.map((a) => a.key);
      const boatType = pickBoatType(rng, activityKeys);
      const manufacturer = rng.pick(MANUFACTURERS);
      const capacity = rng.weighted([[6, 3], [8, 3], [10, 3], [12, 2], [16, 1], [20, 1], [30, 1]] as const);
      const length = rng.int(Math.max(18, capacity + 8), Math.max(26, capacity + 26));
      const currency = destinationCurrency(seedDest.countryCode);

      const charterId = nextId();
      const jitter = () => (rng() - 0.5) * 0.09;
      const depositPercent = rng.weighted([[20, 5], [30, 2], [50, 2], [100, 1]] as const);

      const charter: Charter = {
        id: charterId,
        ownerId: owner.id,
        title: rng.bool(0.5) ? companyName : `${boatName} – ${destination.title}`,
        shortDescription: `${boatType.title} for up to ${capacity} guests, running ${activityList[0].title.toLowerCase()} out of ${destination.title}.`,
        longDescription: buildDescription(rng, {
          boatName,
          boatType: boatType.title,
          capacity,
          length,
          destination: destination.title,
          activityList,
          captain: first,
        }),
        listingType: activityKeys.includes('fishingCharter') ? 'fishing_charter' : 'boat_tour',
        published: true,
        snoozed: false,
        destinationId: destination.id,
        address: `${rng.int(1, 900)} ${rng.pick(['Marina', 'Harbor', 'Dock', 'Bay', 'Pier', 'Shoreline'])} ${rng.pick(['Road', 'Drive', 'Way', 'Blvd'])}`,
        postalCode: String(rng.int(10000, 99999)),
        directions: `Meet at the ${rng.pick(['main dock', 'south pier', 'fuel dock', 'guest slip', 'visitor pontoon'])}. Parking is available on site; give yourself fifteen minutes before departure.`,
        geoPoint: { lat: destination.geoPoint.lat + jitter(), lon: destination.geoPoint.lon + jitter() },
        timezone: destination.timezone,
        currency,
        boat: {
          type: boatType.title,
          category: boatType.category,
          manufacturer: manufacturer.name,
          boatModel: rng.pick(manufacturer.models),
          length,
          capacity,
          yearBuilt: rng.int(2002, 2025),
          isPowered: boatType.powered,
          engineManufacturer: boatType.powered ? rng.pick(['Mercury', 'Yamaha', 'Volvo Penta', 'Mercruiser', 'Suzuki']) : undefined,
          engineHorsepower: boatType.powered ? rng.int(150, 900) : undefined,
          engineCount: boatType.powered ? rng.int(1, 2) : undefined,
          maxSpeed: boatType.powered ? rng.int(18, 42) : rng.int(7, 12),
          engineType: boatType.powered ? rng.pick(['engine_type_inboard', 'engine_type_outboard', 'engine_type_stern_drive']) : 'engine_type_none',
          fuelType: boatType.powered ? rng.pick(['fuel_type_gas', 'fuel_type_diesel']) : 'fuel_type_none',
          numberOfCabins: rng.int(0, 3),
          numberOfBerths: rng.int(0, 6),
          numberOfHeads: rng.int(0, 2),
        },
        amenities: buildAmenities(rng, activityKeys),
        activityKeys,
        policies: {
          freeCancellationDaysInAdvance: rng.weighted([[1, 2], [3, 4], [7, 3], [0, 1]] as const),
          depositPercent,
          hasSecurityDeposit: rng.bool(0.3),
          securityDepositAmount: rng.pick([150, 200, 300, 500]),
          fuelIncludedInPrice: rng.bool(0.75),
          ...defaultPolicyExtras(depositPercent),
          isInstantBookActive: rng.bool(0.45),
          acceptedPaymentMethods: rng
            .sample(paymentMethods.map((p) => p.key), rng.int(3, paymentMethods.length))
            .concat('visa'),
          cardProcessingRate: 0.03,
        },
        photos: Array.from({ length: rng.int(5, 9) }, (_, index) =>
          buildPhoto(rng, charterId, index, `${boatName}, a ${length}ft ${boatType.title.toLowerCase()} in ${destination.title}`),
        ),
        licenseStatus: rng.weighted([['Verified', 4], ['Audited', 4], ['Unverified', 1]] as const),
        verificationBadge: rng.weighted([['basic', 5], ['enhanced', 2], [null, 2]] as const),
        hasBoatersChoiceAward: rng.bool(0.12),
        createdAt: new Date(Date.now() - rng.int(30, 1400) * 86_400_000).toISOString(),
        availabilityUpdatedAt: new Date(Date.now() - rng.int(0, 20) * 86_400_000).toISOString(),
        viewsLast7Days: rng.int(4, 480),
      };

      // De-duplicate accepted payment methods after the forced `visa` append.
      charter.policies.acceptedPaymentMethods = Array.from(new Set(charter.policies.acceptedPaymentMethods));

      charters.push(charter);
      packages.push(...buildPackages(rng, charter, nextId));
      ownerIndex += 1;
    }
  }

  db.charters = charters;
  db.packages = packages;

  // ---- Customers -----------------------------------------------------------
  const customers: User[] = [demoCustomer];
  for (let i = 0; i < 160; i += 1) {
    const user = makeUser({
      id: nextId(),
      email: `${CUSTOMER_FIRST[i % CUSTOMER_FIRST.length].toLowerCase()}.${CUSTOMER_LAST[Math.floor(i / CUSTOMER_FIRST.length) % CUSTOMER_LAST.length].toLowerCase()}.${i}@example.com`,
      firstName: CUSTOMER_FIRST[i % CUSTOMER_FIRST.length],
      lastName: CUSTOMER_LAST[Math.floor(i / CUSTOMER_FIRST.length) % CUSTOMER_LAST.length],
      role: 'customer',
      rng,
    });
    customers.push(user);
    db.users.push(user);
  }

  // ---- Availability blocks -------------------------------------------------
  // Owners close off a scattering of days so search results vary by date.
  const availability: AvailabilityBlock[] = [];
  const start = today();
  for (const charter of charters) {
    const blockedDays = rng.int(2, 14);
    for (let i = 0; i < blockedDays; i += 1) {
      availability.push({
        id: nextId(),
        charterId: charter.id,
        date: addDays(start, rng.int(0, 120)),
        reason: 'manual',
        note: 'Owner blocked',
      });
    }
  }
  db.availability = availability;

  // ---- Bookings, reviews, payouts, threads --------------------------------
  const bookings: Booking[] = [];
  const reviews: Review[] = [];
  const payouts: Payout[] = [];
  const threads: MessageThread[] = [];
  const messages: Message[] = [];

  const packagesByCharter = new Map<string, TripPackage[]>();
  for (const pkg of packages) {
    const list = packagesByCharter.get(pkg.charterId) ?? [];
    list.push(pkg);
    packagesByCharter.set(pkg.charterId, list);
  }

  for (const charter of charters) {
    const charterPackages = packagesByCharter.get(charter.id) ?? [];
    if (!charterPackages.length) continue;

    const bookingCount = rng.int(0, 9);
    for (let i = 0; i < bookingCount; i += 1) {
      const pkg = rng.pick(charterPackages);
      const customer = rng.pick(customers);
      const daysOffset = rng.int(-240, 90);
      const date = addDays(start, daysOffset);
      const adults = Math.min(pkg.capacity, rng.int(pkg.minPersons || 1, Math.max(pkg.minPersons || 1, Math.min(pkg.capacity, 8))));
      const children = rng.bool(0.3) ? rng.int(1, Math.max(1, pkg.capacity - adults)) : 0;

      const status: Booking['status'] =
        daysOffset < 0
          ? rng.weighted([['done', 8], ['cancelled', 1]] as const)
          : rng.weighted([['confirmed', 6], ['pending', 2], ['cancelled', 1]] as const);

      const paymentMode: Booking['paymentMode'] = charter.policies.isInstantBookActive
        ? rng.weighted([['online_full', 3], ['online_deposit', 3], ['on_arrival', 1]] as const)
        : rng.weighted([['online_deposit', 3], ['on_arrival', 3]] as const);

      const breakdown = computeBreakdown({
        charter,
        pkg,
        adults,
        children,
        days: 1,
        paymentMode,
        currency: charter.currency,
      });

      const createdAt = new Date(Date.now() + (daysOffset - rng.int(3, 60)) * 86_400_000).toISOString();
      const booking: Booking = {
        ...bookingExtras(breakdown.dueOnArrival, charter.currency),
        id: nextId(),
        reference: newBookingReference(rng),
        charterId: charter.id,
        packageId: pkg.id,
        customerId: customer.id,
        ownerId: charter.ownerId,
        status,
        date,
        departureTime: rng.pick(pkg.departureTimes),
        adults,
        children,
        days: 1,
        currency: charter.currency,
        breakdown,
        paymentMode,
        contact: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone ?? '',
        },
        createdAt,
        confirmedAt: status === 'pending' ? undefined : createdAt,
        respondByAt: status === 'pending' ? new Date(Date.now() + rng.int(1, 20) * 3_600_000).toISOString() : undefined,
        cancelledAt: status === 'cancelled' ? createdAt : undefined,
      };
      bookings.push(booking);

      // Confirmed and completed bookings consume that day on the calendar.
      if (status === 'confirmed' || status === 'done') {
        availability.push({
          id: nextId(),
          charterId: charter.id,
          date,
          reason: 'booking',
          packageId: pkg.id,
          bookingId: booking.id,
        });

        payouts.push({
          id: nextId(),
          ownerId: charter.ownerId,
          bookingId: booking.id,
          gross: breakdown.total,
          platformFee: roundMoney(breakdown.total * commerceConfig.serviceFeeRate, charter.currency),
          net: roundMoney(breakdown.total * (1 - commerceConfig.serviceFeeRate), charter.currency),
          currency: charter.currency,
          status: status === 'done' ? 'paid' : 'pending',
          scheduledFor: addDays(date, 2),
          paidAt: status === 'done' ? new Date(Date.now() + (daysOffset + 2) * 86_400_000).toISOString() : undefined,
        });
      }

      // Most completed trips leave a review.
      if (status === 'done' && rng.bool(0.72)) {
        const base = rng.weighted([[5, 6], [4, 3], [3, 1]] as const);
        const jitterRating = (v: number) => Math.max(1, Math.min(5, v + (rng.bool(0.3) ? rng.pick([-1, 1]) : 0)));
        const ratings = {
          ratingOverall: base,
          ratingCaptain: jitterRating(base),
          ratingEquipment: jitterRating(base),
        };
        const review: Review = {
          id: nextId(),
          charterId: charter.id,
          bookingId: booking.id,
          customerId: customer.id,
          ownerId: charter.ownerId,
          headline: rng.pick(REVIEW_HEADLINES),
          body: rng.pick(REVIEW_BODIES),
          ratings,
          rating: Number(((ratings.ratingOverall + ratings.ratingCaptain + ratings.ratingEquipment) / 3).toFixed(2)),
          createdAt: new Date(Date.now() + (daysOffset + rng.int(1, 10)) * 86_400_000).toISOString(),
          ownerResponse: rng.bool(0.35) ? 'Thanks for boating with us — great group, come back any time.' : undefined,
        };
        reviews.push(review);
        booking.reviewId = review.id;
      }

      // Booking conversations give the inbox something real to render.
      if (rng.bool(0.4)) {
        const thread: MessageThread = {
          id: nextId(),
          kind: 'booking',
          customerId: customer.id,
          ownerId: charter.ownerId,
          charterId: charter.id,
          bookingId: booking.id,
          subject: charter.title,
          createdAt,
          updatedAt: createdAt,
        };
        threads.push(thread);
        const turns = rng.int(2, MESSAGE_SNIPPETS.length);
        for (let m = 0; m < turns; m += 1) {
          messages.push({
            id: nextId(),
            threadId: thread.id,
            senderId: m % 2 === 0 ? customer.id : charter.ownerId,
            body: MESSAGE_SNIPPETS[m],
            createdAt: new Date(new Date(createdAt).getTime() + m * 3_600_000).toISOString(),
            readAt: m === turns - 1 && rng.bool(0.5) ? undefined : createdAt,
          });
        }
        thread.updatedAt = messages[messages.length - 1].createdAt;
      }
    }
  }

  db.bookings = bookings;
  db.reviews = reviews;
  db.payouts = payouts;
  db.threads = threads;
  db.messages = messages;
  db.availability = availability;

  // Demo customer gets a guaranteed spread of bookings across every state so
  // the account area is never empty on a fresh install.
  seedDemoCustomerActivity(db, demoCustomer, rng, nextId);

  // Demo owner gets payout methods and a team so those screens are populated.
  const demoOwner = db.users.find((u) => u.email === 'owner@boatbooker.demo');
  if (demoOwner?.ownerProfile) {
    demoOwner.ownerProfile.payoutMethods = [
      {
        id: nextId(),
        kind: 'bank',
        label: 'Business checking',
        accountHolder: `${demoOwner.firstName} ${demoOwner.lastName}`,
        last4: '4417',
        currency: 'USD',
        isDefault: true,
        createdAt: new Date(Date.now() - 200 * 86_400_000).toISOString(),
      },
    ];
    demoOwner.ownerProfile.team = [
      {
        id: nextId(),
        name: `${demoOwner.firstName} ${demoOwner.lastName}`,
        email: demoOwner.email,
        role: 'owner',
        invitedAt: demoOwner.createdAt,
        acceptedAt: demoOwner.createdAt,
      },
      {
        id: nextId(),
        name: 'Dana Whitfield',
        email: 'dana@boatbooker.demo',
        role: 'captain',
        invitedAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
        acceptedAt: new Date(Date.now() - 88 * 86_400_000).toISOString(),
      },
    ];
    demoOwner.ownerProfile.verification.status = 'verified';
  }

  // Collections added after the first build — add-ons, itineraries, quick
  // replies, account health, Direct, catches, and a standing offer.
  extendSeed(db, rng, nextId);

  return db;
}

function seedDemoCustomerActivity(db: Database, customer: User, rng: Rng, nextId: () => string) {
  const wanted: { status: Booking['status']; offset: number }[] = [
    { status: 'confirmed', offset: 12 },
    { status: 'confirmed', offset: 34 },
    { status: 'pending', offset: 21 },
    { status: 'done', offset: -30 },
    { status: 'done', offset: -95 },
    { status: 'cancelled', offset: -12 },
  ];

  const pool = db.charters.slice(0, 60);
  const start = today();

  for (const want of wanted) {
    const charter = rng.pick(pool);
    const pkg = rng.pick(db.packages.filter((p) => p.charterId === charter.id));
    if (!pkg) continue;

    const adults = Math.max(pkg.minPersons, 2);
    const paymentMode: Booking['paymentMode'] = 'online_deposit';
    const breakdown = computeBreakdown({
      charter,
      pkg,
      adults,
      children: 0,
      days: 1,
      paymentMode,
      currency: charter.currency,
    });
    const date = addDays(start, want.offset);
    const createdAt = new Date(Date.now() - Math.abs(want.offset + 20) * 86_400_000).toISOString();

    const booking: Booking = {
      ...bookingExtras(breakdown.dueOnArrival, charter.currency),
      id: nextId(),
      reference: newBookingReference(rng),
      charterId: charter.id,
      packageId: pkg.id,
      customerId: customer.id,
      ownerId: charter.ownerId,
      status: want.status,
      date,
      departureTime: pkg.departureTimes[0],
      adults,
      children: 0,
      days: 1,
      currency: charter.currency,
      breakdown,
      paymentMode,
      contact: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone ?? '',
      },
      createdAt,
      confirmedAt: want.status === 'pending' ? undefined : createdAt,
      respondByAt: want.status === 'pending' ? new Date(Date.now() + 14 * 3_600_000).toISOString() : undefined,
      cancelledAt: want.status === 'cancelled' ? createdAt : undefined,
    };
    db.bookings.push(booking);

    if (want.status === 'confirmed') {
      db.availability.push({
        id: nextId(),
        charterId: charter.id,
        date,
        reason: 'booking',
        packageId: pkg.id,
        bookingId: booking.id,
      });
    }

    const thread: MessageThread = {
      id: nextId(),
      kind: 'booking',
      customerId: customer.id,
      ownerId: charter.ownerId,
      charterId: charter.id,
      bookingId: booking.id,
      subject: charter.title,
      createdAt,
      updatedAt: createdAt,
    };
    db.threads.push(thread);
    db.messages.push(
      {
        id: nextId(),
        threadId: thread.id,
        senderId: customer.id,
        body: MESSAGE_SNIPPETS[0],
        createdAt,
        readAt: createdAt,
      },
      {
        id: nextId(),
        threadId: thread.id,
        senderId: charter.ownerId,
        body: MESSAGE_SNIPPETS[1],
        createdAt: new Date(new Date(createdAt).getTime() + 3_600_000).toISOString(),
      },
    );
  }

  // A few saved listings so the wishlist has content.
  for (const charter of rng.sample(pool, 5)) {
    db.wishlist.push({
      id: nextId(),
      userId: customer.id,
      charterId: charter.id,
      createdAt: new Date(Date.now() - rng.int(1, 60) * 86_400_000).toISOString(),
    });
  }

  db.cards.push({
    id: nextId(),
    userId: customer.id,
    brand: 'Visa',
    last4: '4242',
    expMonth: 11,
    expYear: new Date().getFullYear() + 3,
    isDefault: true,
    createdAt: new Date(Date.now() - 120 * 86_400_000).toISOString(),
  });

  db.notifications.push(
    {
      id: nextId(),
      userId: customer.id,
      type: 'booking_accepted_customer',
      category: 'booking',
      channels: ['push', 'email'],
      title: 'Your trip is confirmed',
      body: 'Your upcoming booking has been confirmed by the owner.',
      href: '/account/bookings',
      createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
    {
      id: nextId(),
      userId: customer.id,
      type: 'new_review_captain',
      category: 'review',
      channels: ['push', 'email'],
      title: 'How was your trip?',
      body: 'Leave a review to help other guests choose the right boat.',
      href: '/account/reviews',
      createdAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    },
  );
}

function makeUser(input: {
  id: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: User['role'];
  rng: Rng;
}): User {
  const { rng } = input;
  const credentials = input.password ? hashPassword(input.password) : undefined;
  return {
    id: input.id,
    email: input.email.toLowerCase(),
    passwordHash: credentials?.hash,
    passwordSalt: credentials?.salt,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: `+1 ${rng.int(200, 989)} ${rng.int(200, 999)} ${rng.int(1000, 9999)}`,
    role: input.role,
    status: 'active',
    bio: '',
    language: 'en',
    currency: 'USD',
    timezone: 'America/New_York',
    countryCode: 'us',
    createdAt: new Date(Date.now() - rng.int(30, 1500) * 86_400_000).toISOString(),
    completedTrips: 0,
    creditBalance: 0,
    referralCode: `${input.firstName.toUpperCase().slice(0, 4)}${rng.int(1000, 9999)}`,
    notificationPreferences: {
      emailBookingUpdates: true,
      emailMessages: true,
      emailPromotions: rng.bool(0.5),
      emailReviewReminders: true,
      pushBookingUpdates: true,
      pushMessages: true,
      smsBookingUpdates: rng.bool(0.4),
    },
  };
}

function destinationCurrency(countryCode: string): string {
  const map: Record<string, string> = {
    us: 'USD', bs: 'USD', mx: 'MXN', gr: 'EUR', hr: 'EUR', es: 'EUR', it: 'EUR', th: 'THB', au: 'AUD',
  };
  return map[countryCode] ?? 'USD';
}

function buildDescription(
  rng: Rng,
  input: {
    boatName: string;
    boatType: string;
    capacity: number;
    length: number;
    destination: string;
    activityList: Activity[];
    captain: string;
  },
): string {
  const activityNames = input.activityList.map((a) => a.title.toLowerCase());
  const primary = activityNames[0];
  const rest = activityNames.slice(1, 3);

  const paragraphs = [
    `${input.boatName} is a ${input.length}ft ${input.boatType.toLowerCase()} running out of ${input.destination} with room for ${input.capacity} guests. The boat is set up for ${primary}${rest.length ? `, and also works well for ${rest.join(' and ')}` : ''}.`,
    rng.pick([
      `Trips leave from a marina with parking on site, so getting everyone aboard is straightforward even with a large group. ${input.captain} runs the safety brief before you leave the dock and keeps the pace relaxed once you are out.`,
      `The route is decided on the day based on wind and sea state — there is usually more than one good option, and ${input.captain} will talk you through the choice before you leave.`,
      `Most groups spend a good part of the trip at anchor. There is shade on board, a swim ladder off the stern, and space to spread out without climbing over anyone.`,
    ]),
    rng.pick([
      'Bring sunscreen, a hat and soft-sided bags. Everything else — safety gear, cooler ice, towels — is on board.',
      'You are welcome to bring your own food and drink. There is a cooler on board and ice is provided.',
      'Kids are welcome and there are correctly sized life jackets on board. Let us know ages when you book so the right sizes are ready.',
    ]),
  ];

  return paragraphs.join('\n\n');
}
