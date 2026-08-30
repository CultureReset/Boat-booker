/**
 * Platform taxonomies.
 *
 * Every list here is data, not code: search filters, listing editor form
 * sections, SEO index pages and seed generation all derive from these arrays.
 * Adding an activity or amenity is a one-line change that propagates to the
 * search filters, the listing page, the owner's listing editor and the
 * sitemap without touching a component.
 */

export interface Activity {
  id: number;
  slug: string;
  title: string;
  /** Field name on the listing record that flags this activity. */
  key: string;
  /** Groups the activity in the filter panel and index pages. */
  group: 'tours' | 'water-sports' | 'wildlife' | 'celebrations' | 'fishing';
  blurb: string;
}

export const activities: Activity[] = [
  { id: 1, slug: 'boat-yacht-tours', title: 'Boat & Yacht Tours', key: 'boatYachtTours', group: 'tours', blurb: 'Classic cruising trips on everything from day boats to luxury yachts.' },
  { id: 2, slug: 'sailing-catamaran-gulet-tours', title: 'Sailing, Catamaran & Gulet Tours', key: 'sailingCatamaranGuletTours', group: 'tours', blurb: 'Wind-powered sailing trips with room to stretch out on deck.' },
  { id: 3, slug: 'pontoon-tiki-boat-tours', title: 'Pontoon & Tiki Boat Tours', key: 'pontoonTikiBoatTours', group: 'tours', blurb: 'Relaxed, flat-deck cruising built for groups and shallow water.' },
  { id: 4, slug: 'canal-boat-tours', title: 'Canal Boat Tours', key: 'canalBoatTours', group: 'tours', blurb: 'Slow city sightseeing along historic waterways and canals.' },
  { id: 5, slug: 'sunset-dinner-cruises', title: 'Sunset & Dinner Cruises', key: 'sunsetDinnerCruises', group: 'tours', blurb: 'Evening trips timed around golden hour, often with food on board.' },
  { id: 6, slug: 'island-hopping', title: 'Island Hopping', key: 'islandHopping', group: 'tours', blurb: 'Multi-stop routes between nearby islands, coves and beaches.' },
  { id: 7, slug: 'booze-cruises', title: 'Booze Cruises', key: 'boozeCruises', group: 'celebrations', blurb: 'Party trips where drinks on board are part of the plan.' },
  { id: 8, slug: 'paddleboard-activity', title: 'Paddleboard Activity', key: 'paddleboardActivity', group: 'water-sports', blurb: 'Trips that carry paddleboards for use at anchor.' },
  { id: 9, slug: 'parasailing', title: 'Parasailing', key: 'parasailing', group: 'water-sports', blurb: 'Tow-behind flights with a canopy, run by certified operators.' },
  { id: 10, slug: 'jet-ski-tours', title: 'Jet Ski Tours', key: 'jetSkiTours', group: 'water-sports', blurb: 'Guided personal watercraft rides along the coastline.' },
  { id: 11, slug: 'canoe-kayak-tours', title: 'Canoe & Kayak Tours', key: 'canoeKayakTours', group: 'water-sports', blurb: 'Paddle-powered exploration of quiet water and mangroves.' },
  { id: 12, slug: 'snorkeling-diving-tours', title: 'Snorkeling & Diving Tours', key: 'snorkelingDivingTours', group: 'water-sports', blurb: 'Trips to reefs and wrecks with gear supplied on board.' },
  { id: 13, slug: 'shark-diving', title: 'Shark Diving', key: 'sharkDiving', group: 'wildlife', blurb: 'Supervised encounters with sharks, cage and open water.' },
  { id: 14, slug: 'whale-dolphin-watching', title: 'Whale & Dolphin Watching', key: 'whaleDolphinWatching', group: 'wildlife', blurb: 'Seasonal wildlife spotting with experienced local skippers.' },
  { id: 15, slug: 'fishing', title: 'Fishing', key: 'fishingCharter', group: 'fishing', blurb: 'Inshore, offshore and freshwater fishing charters.' },
  { id: 16, slug: 'swimming-with-pigs', title: 'Swimming With Pigs', key: 'swimmingWithPigs', group: 'wildlife', blurb: 'The Exuma classic — sandbanks, shallow water and swimming pigs.' },
  { id: 17, slug: 'eco-tours', title: 'Eco-Tours', key: 'ecoTours', group: 'wildlife', blurb: 'Low-impact trips focused on habitat, birdlife and conservation.' },
  { id: 18, slug: 'sandbar-tours', title: 'Sandbar Tours', key: 'sandbarTours', group: 'tours', blurb: 'Anchor-up trips to shallow sandbars for swimming and rafting up.' },
  { id: 19, slug: 'stingray-tours', title: 'Stingray Tours', key: 'stingrayTours', group: 'wildlife', blurb: 'Shallow-water stops where rays gather, with guided handling.' },
  { id: 20, slug: 'birthday-celebrations', title: 'Birthday Celebrations', key: 'birthdayCelebrations', group: 'celebrations', blurb: 'Private trips set up for birthdays, with decoration options.' },
  { id: 21, slug: 'bachelorette-bachelor-parties', title: 'Bachelorette & Bachelor Parties', key: 'bacheloretteBachelorParties', group: 'celebrations', blurb: 'Group charters built around a send-off weekend.' },
  { id: 22, slug: 'proposal-engagement-trips', title: 'Proposal & Engagement Trips', key: 'proposalEngagementTrips', group: 'celebrations', blurb: 'Quiet, timed trips arranged around a proposal.' },
  { id: 23, slug: 'corporate-group-events', title: 'Corporate & Group Events', key: 'corporateGroupEvents', group: 'celebrations', blurb: 'Team outings and client entertaining on larger vessels.' },
];

export const activityBySlug = new Map(activities.map((a) => [a.slug, a]));
export const activityByKey = new Map(activities.map((a) => [a.key, a]));

export interface BoatType {
  slug: string;
  title: string;
  /** Broad grouping shown on listing cards and used for coarse filtering. */
  category: 'Yachts' | 'Powerboats' | 'Sailboats' | 'Paddle' | 'Fishing boats' | 'Specialty';
  powered: boolean;
}

export const boatTypes: BoatType[] = [
  { slug: 'airboat', title: 'Airboat', category: 'Specialty', powered: true },
  { slug: 'aluminum-fishing', title: 'Aluminum fishing', category: 'Fishing boats', powered: true },
  { slug: 'bass-boat', title: 'Bass boat', category: 'Fishing boats', powered: true },
  { slug: 'bay-boat', title: 'Bay boat', category: 'Fishing boats', powered: true },
  { slug: 'canoe', title: 'Canoe', category: 'Paddle', powered: false },
  { slug: 'catamaran', title: 'Catamaran', category: 'Sailboats', powered: false },
  { slug: 'center-console', title: 'Center console', category: 'Powerboats', powered: true },
  { slug: 'convertible', title: 'Convertible', category: 'Fishing boats', powered: true },
  { slug: 'cruiser', title: 'Cruiser', category: 'Yachts', powered: true },
  { slug: 'cuddy-cabin', title: 'Cuddy cabin', category: 'Powerboats', powered: true },
  { slug: 'deck-boat', title: 'Deck boat', category: 'Powerboats', powered: true },
  { slug: 'downeast', title: 'Downeast', category: 'Powerboats', powered: true },
  { slug: 'drift-boat', title: 'Drift boat', category: 'Fishing boats', powered: false },
  { slug: 'dual-console', title: 'Dual console', category: 'Powerboats', powered: true },
  { slug: 'flats-boat', title: 'Flats boat', category: 'Fishing boats', powered: true },
  { slug: 'headboat', title: 'Headboat', category: 'Fishing boats', powered: true },
  { slug: 'inflatable-outboard', title: 'Inflatable outboard', category: 'Powerboats', powered: true },
  { slug: 'jet-boat', title: 'Jet boat', category: 'Powerboats', powered: true },
  { slug: 'jon-boat', title: 'Jon boat', category: 'Fishing boats', powered: true },
  { slug: 'kayak', title: 'Kayak', category: 'Paddle', powered: false },
  { slug: 'motor-yacht', title: 'Motor yacht', category: 'Yachts', powered: true },
  { slug: 'panga', title: 'Panga', category: 'Powerboats', powered: true },
  { slug: 'pilothouse', title: 'Pilothouse', category: 'Powerboats', powered: true },
  { slug: 'pontoon', title: 'Pontoon', category: 'Powerboats', powered: true },
  { slug: 'runabout', title: 'Runabout', category: 'Powerboats', powered: true },
  { slug: 'sailing', title: 'Sailing', category: 'Sailboats', powered: false },
  { slug: 'skiff', title: 'Skiff', category: 'Fishing boats', powered: true },
  { slug: 'sportfishing', title: 'Sportfishing', category: 'Fishing boats', powered: true },
  { slug: 'walkaround', title: 'Walkaround', category: 'Fishing boats', powered: true },
  { slug: 'other', title: 'Other', category: 'Specialty', powered: true },
];

export const boatTypeBySlug = new Map(boatTypes.map((b) => [b.slug, b]));
export const boatTypeByTitle = new Map(boatTypes.map((b) => [b.title, b]));

/**
 * Amenity + policy vocabulary. `group` drives both the listing page's
 * "What's on board" sections and the owner listing editor's form sections;
 * `filterable` decides whether it also appears as a search facet.
 */
export interface Amenity {
  key: string;
  title: string;
  group: AmenityGroup;
  icon: string;
  filterable?: boolean;
  /** Rendered as a rule ("Not allowed") rather than a feature when false. */
  policy?: boolean;
}

export type AmenityGroup =
  | 'comfort'
  | 'entertainment'
  | 'navigation'
  | 'safety'
  | 'water-toys'
  | 'fishing-gear'
  | 'catering'
  | 'deck'
  | 'rules';

export const amenityGroupTitles: Record<AmenityGroup, string> = {
  comfort: 'Comfort',
  entertainment: 'Entertainment',
  navigation: 'Navigation & electronics',
  safety: 'Safety',
  'water-toys': 'Water toys',
  'fishing-gear': 'Fishing gear',
  catering: 'Food & drink',
  deck: 'Deck & layout',
  rules: 'Boat rules',
};

export const amenities: Amenity[] = [
  { key: 'wifi', title: 'WiFi', group: 'comfort', icon: 'wifi', filterable: true },
  { key: 'ac', title: 'Air conditioning', group: 'comfort', icon: 'snow', filterable: true },
  { key: 'shower', title: 'Shower', group: 'comfort', icon: 'shower', filterable: true },
  { key: 'kitchen', title: 'Kitchen', group: 'comfort', icon: 'kitchen' },
  { key: 'refrigerator', title: 'Refrigerator', group: 'comfort', icon: 'fridge' },
  { key: 'galleyStoveAndOven', title: 'Galley stove & oven', group: 'comfort', icon: 'stove' },
  { key: 'iceBox', title: 'Ice box', group: 'comfort', icon: 'ice' },
  { key: 'bimini', title: 'Bimini top', group: 'comfort', icon: 'shade', filterable: true },

  { key: 'audioSystem', title: 'Audio system', group: 'entertainment', icon: 'speaker' },
  { key: 'insideSpeakers', title: 'Inside speakers', group: 'entertainment', icon: 'speaker' },
  { key: 'outsideSpeakers', title: 'Outside speakers', group: 'entertainment', icon: 'speaker' },
  { key: 'tv', title: 'TV', group: 'entertainment', icon: 'tv' },

  { key: 'gps', title: 'GPS', group: 'navigation', icon: 'gps' },
  { key: 'chartPlotter', title: 'Chart plotter', group: 'navigation', icon: 'map' },
  { key: 'depthFinder', title: 'Depth finder', group: 'navigation', icon: 'depth' },
  { key: 'fishfinder', title: 'Fish finder', group: 'navigation', icon: 'sonar' },
  { key: 'sonar', title: 'Sonar', group: 'navigation', icon: 'sonar' },
  { key: 'radar', title: 'Radar', group: 'navigation', icon: 'radar' },
  { key: 'autopilot', title: 'Autopilot', group: 'navigation', icon: 'auto' },
  { key: 'bowThruster', title: 'Bow thruster', group: 'navigation', icon: 'thruster' },
  { key: 'wheelSteering', title: 'Wheel steering', group: 'navigation', icon: 'wheel' },

  { key: 'vhfRadio', title: 'VHF radio', group: 'safety', icon: 'radio' },
  { key: 'lifeJackets', title: 'Life jackets', group: 'safety', icon: 'vest', filterable: true },
  { key: 'dinghy', title: 'Dinghy', group: 'safety', icon: 'dinghy' },

  { key: 'paddleboard', title: 'Paddleboard', group: 'water-toys', icon: 'paddle', filterable: true },
  { key: 'kayak', title: 'Kayak', group: 'water-toys', icon: 'kayak', filterable: true },
  { key: 'jetSki', title: 'Jet ski', group: 'water-toys', icon: 'jetski', filterable: true },
  { key: 'wakeboard', title: 'Wakeboard', group: 'water-toys', icon: 'wake' },
  { key: 'waterskis', title: 'Water skis', group: 'water-toys', icon: 'ski' },
  { key: 'snorkelingEquipment', title: 'Snorkeling equipment', group: 'water-toys', icon: 'snorkel', filterable: true },
  { key: 'divingEquipment', title: 'Diving equipment', group: 'water-toys', icon: 'dive' },

  { key: 'fishingEquipment', title: 'Fishing equipment', group: 'fishing-gear', icon: 'rod' },
  { key: 'rodHolders', title: 'Rod holders', group: 'fishing-gear', icon: 'rod' },
  { key: 'baitwell', title: 'Baitwell', group: 'fishing-gear', icon: 'bait' },
  { key: 'catchCleaningFilleting', title: 'Catch cleaning & filleting', group: 'fishing-gear', icon: 'knife' },

  { key: 'snacks', title: 'Snacks', group: 'catering', icon: 'snack' },
  { key: 'drinks', title: 'Drinks', group: 'catering', icon: 'drink' },
  { key: 'lunch', title: 'Lunch', group: 'catering', icon: 'lunch' },
  { key: 'grill', title: 'Grill', group: 'catering', icon: 'grill' },

  { key: 'teakDeck', title: 'Teak deck', group: 'deck', icon: 'deck' },
  { key: 'bowSundeck', title: 'Bow sundeck', group: 'deck', icon: 'sun' },
  { key: 'aftSundeck', title: 'Aft sundeck', group: 'deck', icon: 'sun' },
  { key: 'bathingPlatform', title: 'Bathing platform', group: 'deck', icon: 'ladder' },
  { key: 'flybridge', title: 'Flybridge', group: 'deck', icon: 'bridge' },
  { key: 'anchor', title: 'Anchor', group: 'deck', icon: 'anchor' },

  { key: 'childrenAllowed', title: 'Children allowed', group: 'rules', icon: 'child', policy: true, filterable: true },
  { key: 'pets', title: 'Pets allowed', group: 'rules', icon: 'pet', policy: true, filterable: true },
  { key: 'smoking', title: 'Smoking allowed', group: 'rules', icon: 'smoke', policy: true },
  { key: 'alcohol', title: 'Alcohol allowed', group: 'rules', icon: 'drink', policy: true },
  { key: 'redWine', title: 'Red wine allowed', group: 'rules', icon: 'wine', policy: true },
  { key: 'glassBottles', title: 'Glass bottles allowed', group: 'rules', icon: 'bottle', policy: true },
  { key: 'shoes', title: 'Shoes allowed', group: 'rules', icon: 'shoe', policy: true },
  { key: 'swimming', title: 'Swimming allowed', group: 'rules', icon: 'swim', policy: true },
  { key: 'liveaboard', title: 'Liveaboard', group: 'rules', icon: 'bed', policy: true },
  { key: 'wheelchairAccessible', title: 'Wheelchair accessible', group: 'rules', icon: 'access', policy: true, filterable: true },
];

export const amenityByKey = new Map(amenities.map((a) => [a.key, a]));
export const filterableAmenities = amenities.filter((a) => a.filterable);

/** Payment methods an owner can accept on arrival or online. */
export const paymentMethods = [
  { key: 'visa', title: 'Visa', online: true },
  { key: 'master_card', title: 'Mastercard', online: true },
  { key: 'american_express', title: 'American Express', online: true },
  { key: 'paypal', title: 'PayPal', online: true },
  { key: 'cash', title: 'Cash', online: false },
  { key: 'bank_transfer', title: 'Bank transfer', online: false },
  { key: 'payment_check', title: 'Check', online: false },
] as const;

/** Duration buckets used by both search filters and package labelling. */
export const durationCategories = [
  { key: 'up_to_3', title: 'Up to 3 hours', min: 0, max: 3 },
  { key: '3_6', title: '3 to 6 hours', min: 3, max: 6 },
  { key: '6_9', title: '6 to 9 hours', min: 6, max: 9 },
  { key: 'full_day', title: 'Full day (9+ hours)', min: 9, max: 24 },
  { key: 'multi_day', title: 'Multi-day', min: 24, max: 24 * 30 },
] as const;

export type DurationCategoryKey = (typeof durationCategories)[number]['key'];

export function durationCategoryFor(hours: number): DurationCategoryKey {
  const match = durationCategories.find((d) => hours > d.min && hours <= d.max);
  return match?.key ?? 'multi_day';
}

/** Departure-time buckets, used by the "time of day" search facet. */
export const departureWindows = [
  { key: 'early_morning', title: 'Early morning', from: '04:00', to: '08:00' },
  { key: 'morning', title: 'Morning', from: '08:00', to: '12:00' },
  { key: 'afternoon', title: 'Afternoon', from: '12:00', to: '17:00' },
  { key: 'evening', title: 'Evening', from: '17:00', to: '21:00' },
  { key: 'night', title: 'Night', from: '21:00', to: '04:00' },
] as const;

export type DepartureWindowKey = (typeof departureWindows)[number]['key'];

export function departureWindowFor(time: string): DepartureWindowKey {
  const [h] = time.split(':').map(Number);
  if (h >= 4 && h < 8) return 'early_morning';
  if (h >= 8 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/** Trust badges awarded to listings, mirrored on cards and the listing page. */
export const verificationBadges = {
  basic: {
    key: 'basic',
    title: 'Basic check',
    description: 'This charter has successfully passed a basic check by the %brand% legal team.',
  },
  enhanced: {
    key: 'enhanced',
    title: 'Enhanced check',
    description: 'This charter has successfully passed an enhanced check by the %brand% legal team.',
  },
} as const;

export type VerificationBadge = keyof typeof verificationBadges;

export const licenseStatuses = ['Unverified', 'Audited', 'Verified'] as const;
export type LicenseStatus = (typeof licenseStatuses)[number];

/** Listing types. Determines the noun used in copy ("boat tour" vs "charter"). */
export const listingTypes = [
  { key: 'boat_tour', singular: 'boat tour', plural: 'boat tours' },
  { key: 'fishing_charter', singular: 'fishing charter', plural: 'fishing charters' },
  { key: 'rental', singular: 'boat rental', plural: 'boat rentals' },
] as const;

export type ListingTypeKey = (typeof listingTypes)[number]['key'];

/** Engine and fuel vocabularies used by the boat spec editor. */
export const engineTypes = [
  { key: 'engine_type_inboard', title: 'Inboard' },
  { key: 'engine_type_outboard', title: 'Outboard' },
  { key: 'engine_type_stern_drive', title: 'Stern drive' },
  { key: 'engine_type_jet', title: 'Jet drive' },
  { key: 'engine_type_electric', title: 'Electric' },
  { key: 'engine_type_none', title: 'No engine' },
] as const;

export const fuelTypes = [
  { key: 'fuel_type_gas', title: 'Gas' },
  { key: 'fuel_type_diesel', title: 'Diesel' },
  { key: 'fuel_type_electric', title: 'Electric' },
  { key: 'fuel_type_none', title: 'None' },
] as const;

/** Review sub-scores collected after every completed trip. */
export const reviewCriteria = [
  { key: 'ratingOverall', title: 'Overall experience' },
  { key: 'ratingCaptain', title: 'Captain' },
  { key: 'ratingEquipment', title: 'Boat & equipment' },
] as const;

export type ReviewCriterionKey = (typeof reviewCriteria)[number]['key'];
