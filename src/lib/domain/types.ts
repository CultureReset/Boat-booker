import type {
  DepartureWindowKey,
  DurationCategoryKey,
  LicenseStatus,
  ListingTypeKey,
  ReviewCriterionKey,
  VerificationBadge,
} from '@/config/taxonomy';

/**
 * Canonical domain records.
 *
 * These mirror the entity shapes the production platform exposes (charter,
 * package, booking, review, destination) so an adapter can be pointed at a
 * real API later without reshaping the UI.
 */

export type ID = string;

export type UserRole = 'customer' | 'owner' | 'admin';
export type UserStatus = 'active' | 'pending' | 'disabled';

export interface User {
  id: ID;
  email: string;
  /** Salted PBKDF2 digest. Never leaves the server. */
  passwordHash?: string;
  passwordSalt?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  bio?: string;
  language: string;
  currency: string;
  timezone: string;
  countryCode: string;
  createdAt: string;
  /** Completed trips drive the loyalty tier. */
  completedTrips: number;
  creditBalance: number;
  referralCode: string;
  referredBy?: ID;
  notificationPreferences: NotificationPreferences;
  /** Present only on owner accounts. */
  ownerProfile?: OwnerProfile;
}

export interface NotificationPreferences {
  emailBookingUpdates: boolean;
  emailMessages: boolean;
  emailPromotions: boolean;
  emailReviewReminders: boolean;
  pushBookingUpdates: boolean;
  pushMessages: boolean;
  smsBookingUpdates: boolean;
}

export interface OwnerProfile {
  companyName: string;
  captainName: string;
  captainType: 'captain' | 'company';
  background: string;
  experience?: string;
  languages: string;
  nationality?: string;
  yearStartedRunningCharters: number;
  verification: VerificationState;
  payoutMethods: PayoutMethod[];
  team: TeamMember[];
  onlinePaymentsEnabled: boolean;
  /** Aggregates maintained by the booking service. */
  responseRate: number;
  averageResponseTimeSeconds: number;
}

export type VerificationStatus = 'unverified' | 'pending' | 'verified';

export interface VerificationState {
  status: VerificationStatus;
  documents: { id: ID; kind: 'license' | 'insurance' | 'identity'; filename: string; uploadedAt: string }[];
  reviewedAt?: string;
}

export interface PayoutMethod {
  id: ID;
  kind: 'bank' | 'paypal';
  label: string;
  accountHolder: string;
  /** Only the last four digits are ever stored or displayed. */
  last4: string;
  currency: string;
  isDefault: boolean;
  createdAt: string;
}

export interface TeamMember {
  id: ID;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'captain';
  invitedAt: string;
  acceptedAt?: string;
}

export interface Photo {
  id: ID;
  url: string;
  /** Deterministic gradient used when no bitmap is available. */
  placeholder: string;
  altText: string;
  width: number;
  height: number;
  cardinal: number;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface Country {
  id: ID;
  code: string;
  title: string;
  phoneCode: string;
  continent: string;
}

export interface State {
  id: ID;
  countryId: ID;
  abbrev: string;
  title: string;
}

export interface Destination {
  id: ID;
  slug: string;
  title: string;
  countryId: ID;
  stateId?: ID;
  geoPoint: GeoPoint;
  timezone: string;
  /** Short editorial intro rendered on the destination landing page. */
  blurb: string;
  heroPhoto: Photo;
  popular: boolean;
}

export interface BoatSpec {
  type: string;
  category: string;
  manufacturer?: string;
  boatModel?: string;
  length: number;
  capacity: number;
  yearBuilt?: number;
  yearRestored?: number;
  isPowered: boolean;
  engineManufacturer?: string;
  engineHorsepower?: number;
  engineCount?: number;
  maxSpeed?: number;
  engineType?: string;
  fuelType?: string;
  numberOfCabins?: number;
  numberOfBerths?: number;
  numberOfHeads?: number;
}

export interface CharterPolicies {
  freeCancellationDaysInAdvance: number;
  depositPercent: number;
  hasSecurityDeposit: boolean;
  securityDepositAmount: number;
  fuelIncludedInPrice: boolean;
  isInstantBookActive: boolean;
  acceptedPaymentMethods: string[];
  cardProcessingRate: number;
}

/** A listing. Named "charter" to match the platform's own vocabulary. */
export interface Charter {
  id: ID;
  ownerId: ID;
  title: string;
  shortDescription: string;
  longDescription: string;
  listingType: ListingTypeKey;
  published: boolean;
  snoozed: boolean;
  destinationId: ID;
  address: string;
  postalCode: string;
  directions: string;
  geoPoint: GeoPoint;
  timezone: string;
  currency: string;
  boat: BoatSpec;
  /** Amenity key -> enabled. Keys come from `config/taxonomy`. */
  amenities: Record<string, boolean>;
  /** Activity keys offered by this listing. */
  activityKeys: string[];
  policies: CharterPolicies;
  photos: Photo[];
  licenseStatus: LicenseStatus;
  verificationBadge: VerificationBadge | null;
  hasBoatersChoiceAward: boolean;
  createdAt: string;
  availabilityUpdatedAt: string;
  /** Rolling counter used for the "in demand" badge. */
  viewsLast7Days: number;
}

export type PackageType = 'private' | 'shared';

/** A bookable trip on a listing. */
export interface TripPackage {
  id: ID;
  charterId: ID;
  title: string;
  /** Trip length in hours. Multi-day trips use hours > 24. */
  hours: number;
  durationCategory: DurationCategoryKey;
  type: PackageType;
  price: number;
  currency: string;
  capacity: number;
  minPersons: number;
  /** Base price covers this many guests; extras are charged per head. */
  additionalPersonAfter: number | null;
  additionalPersonPrice: number | null;
  departureTimes: string[];
  /** Bitmask of weekdays the trip runs, Monday = 1. 127 = every day. */
  weekdayMask: number;
  seasonStart?: string;
  seasonEnd?: string;
  minDays: number | null;
  active: boolean;
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'declined'
  | 'expired';

export type PaymentMode = 'online_full' | 'online_deposit' | 'on_arrival';

export interface PriceLine {
  key: string;
  label: string;
  amount: number;
  /** Informational lines (deposits, notes) do not roll into the total. */
  informational?: boolean;
}

export interface PriceBreakdown {
  currency: string;
  lines: PriceLine[];
  subtotal: number;
  discounts: number;
  total: number;
  dueNow: number;
  dueOnArrival: number;
  securityDeposit: number;
}

export interface Booking {
  id: ID;
  reference: string;
  charterId: ID;
  packageId: ID;
  customerId: ID;
  ownerId: ID;
  status: BookingStatus;
  /** ISO date (no time) of the trip. */
  date: string;
  departureTime: string;
  adults: number;
  children: number;
  days: number;
  currency: string;
  breakdown: PriceBreakdown;
  paymentMode: PaymentMode;
  paymentMethodId?: ID;
  messageToOwner?: string;
  contact: { firstName: string; lastName: string; email: string; phone: string };
  createdAt: string;
  respondByAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  refundAmount?: number;
  reviewId?: ID;
}

export interface Review {
  id: ID;
  charterId: ID;
  bookingId: ID;
  customerId: ID;
  ownerId: ID;
  headline: string;
  body: string;
  ratings: Record<ReviewCriterionKey, number>;
  rating: number;
  createdAt: string;
  ownerResponse?: string;
  ownerRespondedAt?: string;
}

export interface ReviewStatistics {
  reviewCount: number;
  rating: number;
  ratingOverall: number;
  ratingCaptain: number;
  ratingEquipment: number;
  stars: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface MessageThread {
  id: ID;
  customerId: ID;
  ownerId: ID;
  charterId: ID;
  bookingId?: ID;
  subject: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: ID;
  threadId: ID;
  senderId: ID;
  body: string;
  createdAt: string;
  readAt?: string;
}

export interface WishlistItem {
  id: ID;
  userId: ID;
  charterId: ID;
  createdAt: string;
}

export interface SavedCard {
  id: ID;
  userId: ID;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  createdAt: string;
}

export type PayoutStatus = 'pending' | 'paid';

export interface Payout {
  id: ID;
  ownerId: ID;
  bookingId: ID;
  gross: number;
  platformFee: number;
  net: number;
  currency: string;
  status: PayoutStatus;
  scheduledFor: string;
  paidAt?: string;
}

/** A day the owner has explicitly closed off, or that a booking has consumed. */
export interface AvailabilityBlock {
  id: ID;
  charterId: ID;
  date: string;
  /** `booking` blocks are derived; `manual` blocks are owner-set. */
  reason: 'manual' | 'booking';
  packageId?: ID;
  bookingId?: ID;
  note?: string;
}

export interface Notification {
  id: ID;
  userId: ID;
  kind: 'booking' | 'message' | 'review' | 'payout' | 'system';
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  readAt?: string;
}

export interface Session {
  token: string;
  userId: ID;
  createdAt: string;
  expiresAt: string;
}

export interface MagicLink {
  token: string;
  email: string;
  /** Which app the link returns into. */
  intent: 'customer' | 'owner';
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface PasswordReset {
  token: string;
  userId: ID;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
}

/** Every collection the storage adapter persists. */
export interface Database {
  users: User[];
  countries: Country[];
  states: State[];
  destinations: Destination[];
  charters: Charter[];
  packages: TripPackage[];
  bookings: Booking[];
  reviews: Review[];
  threads: MessageThread[];
  messages: Message[];
  wishlist: WishlistItem[];
  cards: SavedCard[];
  payouts: Payout[];
  availability: AvailabilityBlock[];
  notifications: Notification[];
  sessions: Session[];
  magicLinks: MagicLink[];
  passwordResets: PasswordReset[];
}

export const emptyDatabase = (): Database => ({
  users: [],
  countries: [],
  states: [],
  destinations: [],
  charters: [],
  packages: [],
  bookings: [],
  reviews: [],
  threads: [],
  messages: [],
  wishlist: [],
  cards: [],
  payouts: [],
  availability: [],
  notifications: [],
  sessions: [],
  magicLinks: [],
  passwordResets: [],
});

export type CollectionName = keyof Database;
