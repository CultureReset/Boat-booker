/**
 * Seed geography.
 *
 * A compact but real-world spread of destinations so search, map bounds,
 * "near me" and the SEO index pages all have something meaningful to render.
 * Adding a destination here makes it searchable, mappable and indexable with
 * no other change.
 */

export interface SeedCountry {
  code: string;
  title: string;
  phoneCode: string;
  continent: string;
}

export interface SeedState {
  countryCode: string;
  abbrev: string;
  title: string;
}

export interface SeedDestination {
  slug: string;
  title: string;
  countryCode: string;
  stateAbbrev?: string;
  lat: number;
  lon: number;
  timezone: string;
  popular: boolean;
  blurb: string;
  /** Rough listing count target, so big destinations feel big. */
  weight: number;
}

export const seedCountries: SeedCountry[] = [
  { code: 'us', title: 'United States', phoneCode: '1', continent: 'North America' },
  { code: 'bs', title: 'Bahamas', phoneCode: '1242', continent: 'North America' },
  { code: 'mx', title: 'Mexico', phoneCode: '52', continent: 'North America' },
  { code: 'gr', title: 'Greece', phoneCode: '30', continent: 'Europe' },
  { code: 'hr', title: 'Croatia', phoneCode: '385', continent: 'Europe' },
  { code: 'es', title: 'Spain', phoneCode: '34', continent: 'Europe' },
  { code: 'it', title: 'Italy', phoneCode: '39', continent: 'Europe' },
  { code: 'th', title: 'Thailand', phoneCode: '66', continent: 'Asia' },
  { code: 'au', title: 'Australia', phoneCode: '61', continent: 'Oceania' },
];

export const seedStates: SeedState[] = [
  { countryCode: 'us', abbrev: 'FL', title: 'Florida' },
  { countryCode: 'us', abbrev: 'CA', title: 'California' },
  { countryCode: 'us', abbrev: 'MO', title: 'Missouri' },
  { countryCode: 'us', abbrev: 'TX', title: 'Texas' },
  { countryCode: 'us', abbrev: 'NY', title: 'New York' },
  { countryCode: 'us', abbrev: 'SC', title: 'South Carolina' },
  { countryCode: 'us', abbrev: 'HI', title: 'Hawaii' },
  { countryCode: 'us', abbrev: 'WA', title: 'Washington' },
];

export const seedDestinations: SeedDestination[] = [
  {
    slug: 'miami', title: 'Miami', countryCode: 'us', stateAbbrev: 'FL',
    lat: 25.7617, lon: -80.1918, timezone: 'America/New_York', popular: true, weight: 14,
    blurb:
      'Biscayne Bay is flat, warm and busy year round. Most trips run out of Miami Beach or Coconut Grove and combine a sandbar stop with a run past Star Island.',
  },
  {
    slug: 'key-west', title: 'Key West', countryCode: 'us', stateAbbrev: 'FL',
    lat: 24.5551, lon: -81.78, timezone: 'America/New_York', popular: true, weight: 10,
    blurb:
      'Shallow, clear water and a short run to the reef. Sunset sails leave the Historic Seaport most evenings and fill up fast in season.',
  },
  {
    slug: 'fort-lauderdale', title: 'Fort Lauderdale', countryCode: 'us', stateAbbrev: 'FL',
    lat: 26.1224, lon: -80.1373, timezone: 'America/New_York', popular: true, weight: 9,
    blurb:
      'The intracoastal runs the length of the city, so trips split between calm canal cruising and heading out through Port Everglades to open water.',
  },
  {
    slug: 'tampa', title: 'Tampa', countryCode: 'us', stateAbbrev: 'FL',
    lat: 27.9506, lon: -82.4572, timezone: 'America/New_York', popular: false, weight: 6,
    blurb:
      'Tampa Bay is protected on all sides, which makes it a forgiving place to be on the water when the Gulf is rough.',
  },
  {
    slug: 'san-diego', title: 'San Diego', countryCode: 'us', stateAbbrev: 'CA',
    lat: 32.7157, lon: -117.1611, timezone: 'America/Los_Angeles', popular: true, weight: 9,
    blurb:
      'Mission Bay for flat water and paddle trips, the harbour for sailing, and a short run offshore for whale watching between December and April.',
  },
  {
    slug: 'marina-del-rey', title: 'Marina del Rey', countryCode: 'us', stateAbbrev: 'CA',
    lat: 33.9802, lon: -118.4517, timezone: 'America/Los_Angeles', popular: false, weight: 6,
    blurb:
      'The largest man-made small-craft harbour in the country. Sunset sails along the Santa Monica coastline are the staple trip.',
  },
  {
    slug: 'lake-ozark', title: 'Lake Ozark', countryCode: 'us', stateAbbrev: 'MO',
    lat: 38.2073, lon: -92.7481, timezone: 'America/Chicago', popular: false, weight: 5,
    blurb:
      'Over a thousand miles of shoreline and no tide to plan around. Cruisers and pontoons dominate, and most trips include a cove stop.',
  },
  {
    slug: 'austin', title: 'Austin', countryCode: 'us', stateAbbrev: 'TX',
    lat: 30.2672, lon: -97.7431, timezone: 'America/Chicago', popular: false, weight: 5,
    blurb:
      'Lake Travis and Lady Bird Lake sit minutes from downtown. Party pontoons and paddle trips make up most of what runs here.',
  },
  {
    slug: 'new-york', title: 'New York', countryCode: 'us', stateAbbrev: 'NY',
    lat: 40.7128, lon: -74.006, timezone: 'America/New_York', popular: true, weight: 8,
    blurb:
      'Trips leave from Chelsea Piers, Sheepshead Bay and Jersey City. The skyline run past the Statue of Liberty is the one everyone books.',
  },
  {
    slug: 'charleston', title: 'Charleston', countryCode: 'us', stateAbbrev: 'SC',
    lat: 32.7765, lon: -79.9311, timezone: 'America/New_York', popular: false, weight: 5,
    blurb:
      'Tidal creeks, barrier islands and a harbour full of history. Dolphin sightings are close to routine on the morning runs.',
  },
  {
    slug: 'honolulu', title: 'Honolulu', countryCode: 'us', stateAbbrev: 'HI',
    lat: 21.3069, lon: -157.8583, timezone: 'Pacific/Honolulu', popular: true, weight: 7,
    blurb:
      'Snorkel trips run to Waikiki and Hanauma side reefs in the morning before the trades pick up; sunset sails leave from Kewalo Basin.',
  },
  {
    slug: 'seattle', title: 'Seattle', countryCode: 'us', stateAbbrev: 'WA',
    lat: 47.6062, lon: -122.3321, timezone: 'America/Los_Angeles', popular: false, weight: 4,
    blurb:
      'Lake Union, Lake Washington and Puget Sound, all reachable in an afternoon. Bring a layer even in August.',
  },
  {
    slug: 'nassau', title: 'Nassau', countryCode: 'bs',
    lat: 25.0443, lon: -77.3504, timezone: 'America/Nassau', popular: true, weight: 8,
    blurb:
      'Short runs to Rose Island and the Exuma cays. Sandbar stops, swimming pigs and stingray encounters are the standard day.',
  },
  {
    slug: 'cancun', title: 'Cancún', countryCode: 'mx',
    lat: 21.1619, lon: -86.8515, timezone: 'America/Cancun', popular: true, weight: 8,
    blurb:
      'Isla Mujeres is a 30-minute crossing and the reef sits just south of it. Catamarans dominate the day-trip market here.',
  },
  {
    slug: 'athens', title: 'Athens', countryCode: 'gr',
    lat: 37.9838, lon: 23.7275, timezone: 'Europe/Athens', popular: true, weight: 7,
    blurb:
      'Day sails to Aegina, Agistri and Moni leave from Alimos marina. The meltemi decides how far anyone actually gets in August.',
  },
  {
    slug: 'mykonos', title: 'Mykonos', countryCode: 'gr',
    lat: 37.4467, lon: 25.3289, timezone: 'Europe/Athens', popular: true, weight: 6,
    blurb:
      'Rib charters to Delos and the south-coast beaches. Book early — the fleet is small relative to the demand.',
  },
  {
    slug: 'split', title: 'Split', countryCode: 'hr',
    lat: 43.5081, lon: 16.4402, timezone: 'Europe/Zagreb', popular: true, weight: 7,
    blurb:
      'The Blue Lagoon, Hvar and Vis are all inside a day trip. Speedboats outnumber sailing charters on the short routes.',
  },
  {
    slug: 'ibiza', title: 'Ibiza', countryCode: 'es',
    lat: 38.9067, lon: 1.4206, timezone: 'Europe/Madrid', popular: true, weight: 6,
    blurb:
      'Formentera is 40 minutes away across clear water. Most charters run half days with an anchor stop for swimming.',
  },
  {
    slug: 'amalfi', title: 'Amalfi', countryCode: 'it',
    lat: 40.634, lon: 14.6027, timezone: 'Europe/Rome', popular: true, weight: 6,
    blurb:
      'Gozzo boats run the coast between Positano and Capri. Sea state matters here — afternoons are often lumpier than mornings.',
  },
  {
    slug: 'phuket', title: 'Phuket', countryCode: 'th',
    lat: 7.8804, lon: 98.3923, timezone: 'Asia/Bangkok', popular: true, weight: 7,
    blurb:
      'Phang Nga Bay and the Phi Phi islands from Chalong or Ao Po. The monsoon flips which side of the island is comfortable.',
  },
  {
    slug: 'sydney', title: 'Sydney', countryCode: 'au',
    lat: -33.8688, lon: 151.2093, timezone: 'Australia/Sydney', popular: true, weight: 6,
    blurb:
      'The harbour is the attraction. Charters leave from Rose Bay and King Street Wharf, and whale season runs May to November.',
  },
];
