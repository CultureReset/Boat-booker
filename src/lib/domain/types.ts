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
  /** Legal entity behind the payouts. Required before any money moves. */
  businessInfo?: BusinessInfo;
  /** Boaters' Choice, assessed quarterly over a trailing year. */
  award?: AwardState;
}

export interface BusinessInfo {
  isRegisteredBusiness: boolean;
  legalName: string;
  taxIdLast4: string;
  taxIdKind: 'ein' | 'ssn';
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  status: 'draft' | 'submitted' | 'verified' | 'suspended';
  submittedAt?: string;
  suspensionNote?: string;
}

/**
 * Award progress against the five published criteria.
 *
 * Assessed on a rolling twelve months and released quarterly, so this holds
 * both the live measurements and whether the last assessment awarded it.
 */
export interface AwardState {
  hasAward: boolean;
  awardedYear?: number;
  assessedAt: string;
  averageReviewScore: number;
  verifiedReviewCount: number;
  reliabilityScore: number;
  responseRate: number;
  fullyVerified: boolean;
}

export const AWARD_THRESHOLDS = {
  averageReviewScore: 4.8,
  verifiedReviewCount: 10,
  reliabilityScore: 0.98,
  responseRate: 0.98,
} as const;

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
  /** Which of the four payment models this listing offers. */
  paymentModels: PaymentModelState[];
  /** Hours of notice required before departure. */
  advanceNoticeHours: number;
  /** How far out the calendar is open by default. */
  bookingWindowDays: number;
  /** Tipping can be switched off by operators who prefer cash. */
  onlineTippingEnabled: boolean;
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

/**
 * The eleven states a booking can occupy.
 *
 * `confirmed` and `accepted` look redundant and are not: the platform keeps the
 * guest-facing word ("confirmed", reached by instant book) distinct from the
 * operator-facing one ("accepted", reached by an operator approving a request),
 * and surfaces whichever matches the reader. `done` — not "completed" — is the
 * terminal state once the trip date has passed.
 */
export type BookingStatus =
  | 'request'
  | 'pending'
  | 'confirmed'
  | 'accepted'
  | 'change_requested'
  | 'change_pending'
  | 'cancel_requested'
  | 'cancelled'
  | 'declined'
  | 'withdrawn'
  | 'done';

/** Statuses in which the trip is still going to happen. */
export const LIVE_BOOKING_STATUSES: BookingStatus[] = [
  'request',
  'pending',
  'confirmed',
  'accepted',
  'change_requested',
  'change_pending',
  'cancel_requested',
];

/** Statuses that hold a calendar date. A pending request holds one too — */
/** otherwise an operator could accept a day sold underneath them. */
export const DATE_HOLDING_STATUSES: BookingStatus[] = LIVE_BOOKING_STATUSES;

export type PaymentMode = 'online_full' | 'online_deposit' | 'on_arrival';

/**
 * How an operator lets guests pay, toggled per listing.
 *
 * At least one must stay active, which `owner.setPaymentModels` enforces.
 * `remaining_balance` and `tip` are additive: they do not change how a booking
 * is taken, only what the guest can settle online afterwards.
 */
export type PaymentModelKey = 'deposit' | 'full_upfront' | 'remaining_balance' | 'tip';

export interface PaymentModelState {
  key: PaymentModelKey;
  active: boolean;
  /** Only meaningful for `deposit`. */
  depositPercent?: number;
  /** Who absorbs the card processing fee. Legal only in some US states. */
  feeBearer: 'operator' | 'customer';
}

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
  cancellationReason?: CancellationReasonKey;
  refundAmount?: number;
  reviewId?: ID;
  /** Set when the booking came in through Direct — no commission is taken. */
  source: BookingSource;
  /** Add-ons chosen at checkout, priced at the time of booking. */
  addOns: BookingAddOn[];
  /** Populated once the guest tips. Tips never affect commission. */
  tip?: TipRecord;
  /** Tracks what is still owed and how it will be collected. */
  balance: BalanceState;
  /** The change request currently in flight, if any. */
  changeRequestId?: ID;
  /** Present once cancelled — carries the reason and what it cost the operator. */
  cancellation?: CancellationRecord;
  /** The offer this booking was created from, if it came out of a thread. */
  offerId?: ID;
  /** Guests invited to come along. */
  buddyInvitations: BuddyInvitation[];
}

export type BookingSource = 'marketplace' | 'direct' | 'manual';

export interface BookingAddOn {
  addOnId: ID;
  title: string;
  unitPrice: number;
  quantity: number;
}

/**
 * How the money outstanding on a booking gets collected.
 *
 * Three behaviours coexist in the real product and the guest picks between
 * them: settle in person with the operator, pay online whenever they like, or
 * let the platform charge the card automatically on a scheduled date. The
 * scheduled charge is always cancellable back to one of the other two.
 */
export interface BalanceState {
  outstanding: number;
  currency: string;
  mode: 'direct_to_operator' | 'online_anytime' | 'scheduled';
  /** Only for `scheduled`. ISO date the card is charged. */
  scheduledFor?: string;
  paidAt?: string;
  lastAttemptFailedAt?: string;
  /** Single-use token backing the standalone /pay/balance link. */
  paymentToken?: string;
  paymentTokenExpiresAt?: string;
}

export interface TipRecord {
  amount: number;
  currency: string;
  percentOfTripPrice: number;
  paidAt: string;
}

/* ------------------------------------------------------------------ offers */

export type OfferStatus = 'sent' | 'accepted' | 'withdrawn' | 'expired';

/**
 * An operator-built, priced invitation to book, sent inside a thread.
 *
 * The operator's calendar stays open while an offer is outstanding — the offer
 * is a quote, not a hold — so two offers on the same date can both be live and
 * the first acceptance wins through the usual availability check.
 */
export interface Offer {
  id: ID;
  threadId: ID;
  charterId: ID;
  ownerId: ID;
  customerId: ID;
  /** Null when the operator built a bespoke trip rather than picking one. */
  packageId: ID | null;
  customTrip?: {
    title: string;
    description: string;
    hours: number;
    departureTime: string;
  };
  date: string;
  departureTime: string;
  adults: number;
  children: number;
  days: number;
  /** Total for the trip, which may undercut the package's list price. */
  price: number;
  currency: string;
  status: OfferStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  withdrawnAt?: string;
  bookingId?: ID;
}

export type InquiryStatus = 'open' | 'pre_approved' | 'declined' | 'converted';

/** A guest's question about a listing, before any booking exists. */
export interface Inquiry {
  id: ID;
  threadId: ID;
  charterId: ID;
  ownerId: ID;
  customerId: ID;
  date?: string;
  adults: number;
  children: number;
  status: InquiryStatus;
  createdAt: string;
  respondByAt: string;
  respondedAt?: string;
}

/* --------------------------------------------------- booking change requests */

export type ChangeRequestStatus =
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired'
  | 'manual_review';

export interface ChangeRequestFields {
  date?: string;
  departureTime?: string;
  adults?: number;
  children?: number;
  days?: number;
  packageId?: ID;
}

/**
 * A proposed amendment to a confirmed booking, from either side.
 *
 * Accepting applies immediately *unless* the price moves, in which case the
 * request goes to `manual_review` — the real platform routes priced changes
 * through support rather than charging or refunding automatically.
 */
export interface ChangeRequest {
  id: ID;
  bookingId: ID;
  requestedBy: 'customer' | 'owner';
  requestedByUserId: ID;
  original: Required<ChangeRequestFields>;
  requested: ChangeRequestFields;
  note: string;
  priceDifference: number;
  currency: string;
  status: ChangeRequestStatus;
  createdAt: string;
  expiresAt: string;
  resolvedAt?: string;
}

/* --------------------------------------------------- cancellation & penalty */

export type CancellationReasonKey =
  // customer-initiated
  | 'plans_changed'
  | 'found_better_deal_here'
  | 'found_better_deal_elsewhere'
  | 'operator_offered_lower_rate'
  | 'need_to_change_details'
  | 'operator_needs_to_cancel'
  | 'could_not_attend'
  | 'operator_no_show'
  // operator-initiated
  | 'bad_weather'
  | 'boat_malfunction'
  | 'boat_out_of_water'
  | 'already_booked'
  | 'not_enough_people'
  | 'customer_wants_to_cancel'
  | 'activity_unavailable'
  | 'wrong_price'
  | 'want_to_unlist'
  | 'moving_location'
  | 'capacity_too_high'
  | 'customer_no_show'
  // either
  | 'extenuating_circumstances'
  | 'other';

export type PenaltyKey =
  | 'rank_drop'
  | 'calendar_blocked'
  | 'calendar_opened'
  | 'automatic_cancel_review'
  | 'instant_book_warning'
  | 'instant_book_lost'
  | 'refund_customer'
  | 'operator_keeps_deposit';

export type PenaltyImpact = 'none' | 'low' | 'medium' | 'high' | 'very_high';

export interface AppliedPenalty {
  key: PenaltyKey;
  impact: PenaltyImpact;
}

export interface CancellationRecord {
  reason: CancellationReasonKey;
  initiatedBy: 'customer' | 'owner' | 'system';
  note?: string;
  cancelledAt: string;
  refundAmount: number;
  forfeitedAmount: number;
  /** Empty when the reason is penalty-free (weather, extenuating, etc.). */
  penalties: AppliedPenalty[];
  /** Some cancellations need a human to decide the refund. */
  pendingSupportReview: boolean;
}

/* ------------------------------------------------------------ account health */

export type SuspensionReasonKey =
  | 'boat_malfunction'
  | 'bypass_attempt'
  | 'low_realization_rate'
  | 'low_account_health'
  | 'credentials_missing'
  | 'other';

/**
 * The graduated throttle the platform applies before it pauses a listing.
 *
 * A listing first gets a cap on new bookings; only if the signal persists does
 * it get paused outright. Modelling the cap separately is what makes the
 * difference visible to the operator rather than arriving as a cliff.
 */
export interface AccountHealth {
  ownerId: ID;
  realizationRate: number;
  responseRate: number;
  /** Double-bookings this year. Four costs the operator Instant Book. */
  instantBookStrikes: number;
  bypassAttempts: number;
  boatMalfunctionCancellations: number;
  /** null = no cap. */
  bookingLimit: number | null;
  bookingsSinceLimit: number;
  suspensions: ListingSuspension[];
  updatedAt: string;
}

export interface ListingSuspension {
  charterId: ID;
  reason: SuspensionReasonKey;
  mode: 'booking_limit' | 'paused';
  current?: number;
  limit?: number;
  createdAt: string;
  liftedAt?: string;
}

/* ---------------------------------------------------------------- itineraries */

export interface ItineraryStep {
  id: ID;
  title: string;
  description: string;
  /** Minutes. Optional — not every step is timed. */
  durationMinutes?: number;
  isMeetingPoint: boolean;
}

/**
 * A per-trip, per-day plan of what happens on the water.
 *
 * Publishing is gated on two steps per day, and a published itinerary must be
 * unpublished before it can be edited — the guest-facing copy is treated as a
 * commitment rather than a draft that can shift under a booked customer.
 */
export interface Itinerary {
  id: ID;
  charterId: ID;
  packageId: ID;
  status: 'draft' | 'published';
  /** One entry per trip day; index 0 is day 1. */
  days: { steps: ItineraryStep[] }[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export const ITINERARY_MIN_STEPS_PER_DAY = 2;

/* -------------------------------------------------------------------- add-ons */

export interface AddOn {
  id: ID;
  charterId: ID;
  title: string;
  description: string;
  price: number;
  currency: string;
  /** `per_person` multiplies by group size, `per_booking` charges once. */
  pricing: 'per_person' | 'per_booking';
  maxQuantity: number;
  active: boolean;
}

/* -------------------------------------------------------------- quick replies */

/** An operator's saved message template. `{{variable}}` slots interpolate. */
export interface QuickReply {
  id: ID;
  ownerId: ID;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export const QUICK_REPLY_PLACEHOLDERS = [
  'customer_name',
  'captain_name',
  'charter_title',
  'trip_date',
  'departure_time',
  'group_size',
] as const;

export type QuickReplyPlaceholder = (typeof QUICK_REPLY_PLACEHOLDERS)[number];

/* -------------------------------------------------------------------- direct */

export interface DirectSettings {
  ownerId: ID;
  enabled: boolean;
  termsAcceptedAt?: string;
  /** Public slug behind the shareable book-direct link. */
  slug: string;
  /** Operator or customer absorbs the 2.65% + $0.30. */
  feeBearer: 'operator' | 'customer';
  invitesSent: number;
}

export type InviteChannel = 'email' | 'sms' | 'qr';

export interface BookingInvite {
  id: ID;
  ownerId: ID;
  charterId: ID;
  channel: InviteChannel;
  /** Email address or phone number; absent for QR. */
  recipient?: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  openedAt?: string;
  bookingId?: ID;
}

/* --------------------------------------------------------------- calendars */

export interface ExternalCalendar {
  id: ID;
  ownerId: ID;
  charterId: ID;
  name: string;
  /** iCal feed URL. Read-only import. */
  url: string;
  provider: 'google' | 'icloud' | 'other';
  lastSyncedAt?: string;
  lastSyncError?: string;
}

/**
 * Two listings that share a physical boat.
 *
 * A booking on either blocks the same date on the other, which is the only way
 * to run one hull under two listings without double-selling it.
 */
export interface CalendarLink {
  id: ID;
  ownerId: ID;
  charterIds: ID[];
  createdAt: string;
}

/* ----------------------------------------------------------------- social */

export interface BuddyInvitation {
  id: ID;
  email: string;
  name?: string;
  invitedAt: string;
  acceptedAt?: string;
}

export interface SharedWishlist {
  token: string;
  userId: ID;
  createdAt: string;
}

/** A photo posted from a completed trip, shown in the public catches feed. */
export interface Catch {
  id: ID;
  bookingId: ID;
  charterId: ID;
  customerId: ID;
  destinationId: ID;
  title: string;
  photo: Photo;
  caption: string;
  /** 1-12. Drives the month/season filters on the feed. */
  month: number;
  likes: number;
  createdAt: string;
}

/* ------------------------------------------------------------ verification */

export type PhoneVerificationPurpose = 'registration' | 'profile';

export interface PhoneVerification {
  id: ID;
  userId: ID;
  phone: string;
  /** Six digits. Never returned to the client outside dev. */
  code: string;
  purpose: PhoneVerificationPurpose;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  attempts: number;
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

export type ThreadKind = 'inquiry' | 'booking' | 'offer' | 'support';

export interface MessageThread {
  id: ID;
  kind: ThreadKind;
  customerId: ID;
  ownerId: ID;
  charterId: ID;
  bookingId?: ID;
  offerId?: ID;
  inquiryId?: ID;
  subject: string;
  createdAt: string;
  updatedAt: string;
  archivedByCustomer?: boolean;
  archivedByOwner?: boolean;
  /** Raised when the anti-bypass heuristics see repeated off-platform pushes. */
  flaggedAt?: string;
  reportedAt?: string;
}

/**
 * A message, or a system event rendered inline in the thread.
 *
 * System rows carry `systemEvent` and no sender — they are how the thread shows
 * "Booking accepted" or "Offer expired" in line with the conversation rather
 * than in a separate activity log.
 */
export interface Message {
  id: ID;
  threadId: ID;
  senderId?: ID;
  body: string;
  createdAt: string;
  readAt?: string;
  deliveredAt?: string;
  editedAt?: string;
  deletedAt?: string;
  photoId?: ID;
  photo?: Photo;
  systemEvent?: SystemEventKey;
  /** Set when the composer stripped or flagged contact details. */
  moderation?: 'contact_stripped' | 'policy_warning';
}

export type SystemEventKey =
  | 'booking_requested'
  | 'booking_received'
  | 'booking_accepted'
  | 'booking_confirmed'
  | 'booking_declined'
  | 'booking_cancelled'
  | 'booking_done'
  | 'change_requested'
  | 'change_accepted'
  | 'change_declined'
  | 'change_withdrawn'
  | 'change_expired'
  | 'offer_sent'
  | 'offer_withdrawn'
  | 'offer_expired'
  | 'offer_accepted'
  | 'inquiry_sent'
  | 'inquiry_declined'
  | 'inquiry_pre_approved';

/** Windows during which a sender can still change their own message. */
export const MESSAGE_EDIT_WINDOW_MINUTES = 15;
export const MESSAGE_DELETE_WINDOW_HOURS = 24;

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

export type NotificationChannel = 'push' | 'email' | 'sms';

export type NotificationCategory =
  | 'booking'
  | 'message'
  | 'review'
  | 'payout'
  | 'onboarding'
  | 'product_update'
  | 'ticket'
  | 'marketing'
  | 'system';

export interface Notification {
  id: ID;
  userId: ID;
  /** Key into the notification catalogue; decides copy and routing. */
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  readAt?: string;
  archivedAt?: string;
  /** Which channels this send actually went out on, after preferences. */
  channels: NotificationChannel[];
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
  offers: Offer[];
  inquiries: Inquiry[];
  changeRequests: ChangeRequest[];
  itineraries: Itinerary[];
  addOns: AddOn[];
  quickReplies: QuickReply[];
  accountHealth: AccountHealth[];
  directSettings: DirectSettings[];
  bookingInvites: BookingInvite[];
  externalCalendars: ExternalCalendar[];
  calendarLinks: CalendarLink[];
  sharedWishlists: SharedWishlist[];
  catches: Catch[];
  phoneVerifications: PhoneVerification[];
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
  offers: [],
  inquiries: [],
  changeRequests: [],
  itineraries: [],
  addOns: [],
  quickReplies: [],
  accountHealth: [],
  directSettings: [],
  bookingInvites: [],
  externalCalendars: [],
  calendarLinks: [],
  sharedWishlists: [],
  catches: [],
  phoneVerifications: [],
});

export type CollectionName = keyof Database;
