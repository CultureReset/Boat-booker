import { ITINERARY_MIN_STEPS_PER_DAY } from '@/lib/domain/types';
import type { Charter, Database, User } from '@/lib/domain/types';

/**
 * Listing improvement opportunities.
 *
 * Not a checklist — a *scored* set of specific, actionable gaps, each with the
 * reason it matters. The difference is that a checklist says "add photos" and
 * an opportunity says "add exterior photos from different angles to clearly
 * show your boat", which an operator can act on without guessing.
 *
 * Every opportunity is derived from data the platform already has, so nothing
 * here needs the operator to self-assess. Each one names the screen that fixes
 * it, because an improvement suggestion that does not link to its own remedy is
 * just a complaint.
 */

/** The three framings the operator app groups opportunities under. */
export type OpportunityContext = 'appeal' | 'convenience' | 'experience';

export type OpportunityCategory =
  | 'gallery'
  | 'profile'
  | 'trips'
  | 'itinerary'
  | 'availability'
  | 'reviews';

export interface Opportunity {
  key: string;
  context: OpportunityContext;
  category: OpportunityCategory;
  title: string;
  description: string;
  /** Where to go and fix it. */
  href: string;
  /** How much closing this moves the completeness score. */
  weight: number;
  completed: boolean;
}

export const CONTEXT_COPY: Record<OpportunityContext, { title: string; description: string }> = {
  appeal: {
    title: 'Stand out',
    description: 'Why would customers pick your charter over the boat next door?',
  },
  convenience: {
    title: 'Make it easy to book',
    description: 'Settings that rank you higher and reduce hesitation at booking.',
  },
  experience: {
    title: 'Each trip, in detail',
    description: 'Spell out the day so the right customer books the right trip.',
  },
};

export const CATEGORY_COPY: Record<OpportunityCategory, { title: string; description: string }> = {
  gallery: {
    title: 'Improve your gallery',
    description: 'Show customers exactly what to expect. Better photos get more bookings.',
  },
  profile: {
    title: 'Introduce yourself',
    description: 'Guests like knowing who is taking them out. Tell them about yourself.',
  },
  trips: {
    title: 'Expand your offer',
    description: 'Capture attention by widening the range of trips you run.',
  },
  itinerary: {
    title: 'Add trip itineraries',
    description: 'Show guests exactly what to expect, step by step. A clear plan helps them book.',
  },
  availability: {
    title: 'Organise your schedule',
    description: 'Save time, avoid double bookings, and prepare for upcoming trips.',
  },
  reviews: {
    title: 'Build your reputation',
    description: 'Invite previous customers to leave a review.',
  },
};

/** Score bands, each with the encouragement the real product shows. */
const BAND_COPY = [
  'Get started now to make your listing visible and attract customers. Every detail counts.',
  'You’re on your way. Keep adding details to improve visibility and attract bookings.',
  'Keep it up. More detail about your offer helps your listing stand out.',
  'Looking better. Highlight what makes your charter unique to stand out from the competition.',
  'Almost there. A few final touches will maximise your listing’s potential.',
  'All set. Your listing is fully optimised and ready to attract customers.',
] as const;

export interface OpportunityReport {
  charterId: string;
  charterTitle: string;
  /** 0–5, the band the completeness score falls into. */
  band: number;
  bandCopy: string;
  /** 0–100. */
  score: number;
  completedCount: number;
  totalCount: number;
  opportunities: Opportunity[];
}

/**
 * Builds the full report for one listing.
 *
 * Completed opportunities are kept in the list rather than filtered out — the
 * operator wants to see what they have already done, and a list that shrinks as
 * you work reads as if the goalposts are moving.
 */
export function opportunitiesFor(db: Database, charter: Charter, owner: User): OpportunityReport {
  const base = `/owner/listings/${charter.id}`;
  const packages = db.packages.filter((p) => p.charterId === charter.id && p.active);
  const itineraries = db.itineraries.filter((i) => i.charterId === charter.id);
  const reviews = db.reviews.filter((r) => r.charterId === charter.id);
  const photos = charter.photos;

  const draftItineraries = itineraries.filter((i) => i.status === 'draft').length;
  const missingItineraries = packages.filter(
    (pkg) => !itineraries.some((i) => i.packageId === pkg.id && i.status === 'published'),
  ).length;

  const linkedCalendars = db.calendarLinks.some((l) => l.charterIds.includes(charter.id));
  const ownerListings = db.charters.filter((c) => c.ownerId === charter.ownerId);

  const opportunities: Opportunity[] = [
    // --- Appeal -----------------------------------------------------------
    {
      key: 'exterior_photos',
      context: 'appeal',
      category: 'gallery',
      title: 'Show your boat from every angle',
      description: 'Add exterior photos from different angles so guests can see the whole boat.',
      href: `${base}?step=photos`,
      weight: 3,
      completed: photos.length >= 6,
    },
    {
      key: 'interior_photos',
      context: 'appeal',
      category: 'gallery',
      title: 'Show what it’s like on board',
      description: 'Add photos of seating, shade and facilities to set expectations.',
      href: `${base}?step=photos`,
      weight: 2,
      completed: photos.length >= 10,
    },
    {
      key: 'profile_photo',
      context: 'appeal',
      category: 'profile',
      title: 'Add a profile photo',
      description: 'Show customers who they will be boating with.',
      href: '/owner/settings',
      weight: 2,
      completed: Boolean(owner.avatarUrl),
    },
    {
      key: 'background',
      context: 'appeal',
      category: 'profile',
      title: 'Tell us a bit about your background',
      description: 'How did you get started? What drives you? Guests read this.',
      href: '/owner/settings',
      weight: 2,
      completed: (owner.ownerProfile?.background ?? '').length > 80,
    },
    {
      key: 'years_experience',
      context: 'appeal',
      category: 'profile',
      title: 'Add your years of experience',
      description: 'When did you start running trips?',
      href: '/owner/settings',
      weight: 1,
      completed: Boolean(owner.ownerProfile?.yearStartedRunningCharters),
    },
    {
      key: 'reviews',
      context: 'appeal',
      category: 'reviews',
      title: 'Get reviews',
      description: 'Build your reputation by inviting previous customers to leave a review.',
      href: '/owner/reviews',
      weight: 3,
      completed: reviews.length >= 5,
    },

    // --- Convenience ------------------------------------------------------
    {
      key: 'instant_book',
      context: 'convenience',
      category: 'availability',
      title: 'Choose Instant Book for your trips',
      description: 'Let customers book and confirm a date instantly — most of them prefer it.',
      href: `${base}?step=policies`,
      weight: 3,
      completed: charter.policies.isInstantBookActive,
    },
    {
      key: 'free_cancellation',
      context: 'convenience',
      category: 'availability',
      title: 'Set a free cancellation policy',
      description: 'Allowing cancellations reduces hesitation at the point of booking.',
      href: `${base}?step=policies`,
      weight: 2,
      completed: charter.policies.freeCancellationDaysInAdvance > 0,
    },
    {
      key: 'advance_notice',
      context: 'convenience',
      category: 'availability',
      title: 'Decrease your advance notice period',
      description: 'A shorter notice period lets customers book last-minute trips.',
      href: `${base}?step=policies`,
      weight: 1,
      completed: charter.policies.advanceNoticeHours <= 24,
    },
    {
      key: 'linked_calendars',
      context: 'convenience',
      category: 'availability',
      title: 'Link your calendars',
      description:
        'Link listings that share a boat so a booking on one blocks the same date on the other.',
      href: '/owner/calendar/links',
      weight: 2,
      // Only meaningful with more than one listing to link.
      completed: ownerListings.length < 2 || linkedCalendars,
    },
    {
      key: 'payment_models',
      context: 'convenience',
      category: 'availability',
      title: 'Offer more ways to pay',
      description: 'Customers who can pay in full online are less likely to cancel.',
      href: `${base}?step=payments`,
      weight: 2,
      completed: charter.policies.paymentModels.filter((m) => m.active).length > 1,
    },

    // --- Experience -------------------------------------------------------
    {
      key: 'trip_count',
      context: 'experience',
      category: 'trips',
      title: 'Add another trip',
      description: 'More options mean more chances to match what a customer is looking for.',
      href: `${base}?step=trips`,
      weight: 2,
      completed: packages.length >= 3,
    },
    {
      key: 'trip_descriptions',
      context: 'experience',
      category: 'trips',
      title: 'Describe every trip',
      description: 'What does this trip actually look like? Guests choose on this.',
      href: `${base}?step=trips`,
      weight: 2,
      completed: packages.length > 0 && packages.every((p) => p.title.length > 3),
    },
    {
      key: 'itineraries',
      context: 'experience',
      category: 'itinerary',
      title:
        missingItineraries === 0
          ? 'All trips have itineraries'
          : `Add itineraries to ${missingItineraries} trip${missingItineraries === 1 ? '' : 's'}`,
      description: 'Give guests a clear picture of the day before they book.',
      href: `${base}/itineraries`,
      weight: 3,
      completed: packages.length > 0 && missingItineraries === 0,
    },
    {
      key: 'draft_itineraries',
      context: 'experience',
      category: 'itinerary',
      title:
        draftItineraries === 0
          ? 'All itineraries are published'
          : `Finish ${draftItineraries} draft itinerar${draftItineraries === 1 ? 'y' : 'ies'}`,
      description: `Add the remaining steps — at least ${ITINERARY_MIN_STEPS_PER_DAY} per day — and publish them.`,
      href: `${base}/itineraries`,
      weight: 2,
      completed: draftItineraries === 0,
    },
    {
      key: 'add_ons',
      context: 'experience',
      category: 'trips',
      title: 'Offer paid extras',
      description: 'Lunch, photos, transfers — extras raise the value of every booking.',
      href: `${base}/add-ons`,
      weight: 1,
      completed: db.addOns.some((a) => a.charterId === charter.id && a.active),
    },
    {
      key: 'amenity_detail',
      context: 'experience',
      category: 'trips',
      title: 'Add detail about what’s on board',
      description:
        'Describe the specifics — the type of toilet, whether lunch is included, what the drinks are.',
      href: `${base}?step=amenities`,
      weight: 1,
      completed: charter.longDescription.length > 400,
    },
  ];

  const totalWeight = opportunities.reduce((sum, o) => sum + o.weight, 0);
  const earned = opportunities.reduce((sum, o) => sum + (o.completed ? o.weight : 0), 0);
  const score = totalWeight ? Math.round((earned / totalWeight) * 100) : 0;
  const band = Math.min(5, Math.floor(score / 20));

  return {
    charterId: charter.id,
    charterTitle: charter.title,
    band,
    bandCopy: BAND_COPY[band],
    score,
    completedCount: opportunities.filter((o) => o.completed).length,
    totalCount: opportunities.length,
    opportunities,
  };
}

/** Reports for every listing an operator runs, worst score first. */
export function opportunitiesForOwner(db: Database, ownerId: string): OpportunityReport[] {
  const owner = db.users.find((u) => u.id === ownerId);
  if (!owner) return [];

  return db.charters
    .filter((c) => c.ownerId === ownerId)
    .map((charter) => opportunitiesFor(db, charter, owner))
    .sort((a, b) => a.score - b.score);
}

/**
 * The operator's "next steps" — the blocking prerequisites, not suggestions.
 *
 * Distinct from opportunities: these gate publishing and payouts, so they are
 * requirements dressed as prompts rather than improvements.
 */
export interface NextStep {
  key: string;
  title: string;
  description: string;
  requiredTo: string;
  href: string;
  icon: string;
  done: boolean;
}

export function nextStepsFor(db: Database, ownerId: string): NextStep[] {
  const owner = db.users.find((u) => u.id === ownerId);
  if (!owner) return [];

  const profile = owner.ownerProfile;
  const listings = db.charters.filter((c) => c.ownerId === ownerId);
  const published = listings.filter((c) => c.published);
  const pendingPayouts = db.payouts.filter((p) => p.ownerId === ownerId && p.status === 'pending');
  const heldAmount = pendingPayouts.reduce((sum, p) => sum + p.net, 0);

  return [
    {
      key: 'complete_listing',
      title: 'Complete your listing',
      description: 'Add your boat details, photos and policies so customers can book you.',
      requiredTo: 'Required to publish',
      href: listings[0] ? `/owner/listings/${listings[0].id}` : '/owner/listings',
      icon: 'boat',
      done: published.length > 0,
    },
    {
      key: 'get_verified',
      title: 'Get verified',
      description: 'Upload your credentials to build trust and gain a small ranking boost.',
      requiredTo: 'Required to publish',
      href: '/owner/verification',
      icon: 'shield',
      done: profile?.verification.status === 'verified',
    },
    {
      key: 'business_info',
      title: 'Add business info',
      description: 'Add your details to enable advanced payment options via your bank account.',
      requiredTo: 'Required to get paid',
      href: '/owner/settings',
      icon: 'tag',
      done: Boolean(profile?.businessInfo),
    },
    {
      key: 'payout_method',
      title: 'Add a payout method',
      description: 'Connect a bank account or PayPal so we know where to send your money.',
      requiredTo: 'Required to get paid',
      href: '/owner/payout-methods',
      icon: 'wallet',
      done: (profile?.payoutMethods.length ?? 0) > 0,
    },
    {
      key: 'claim_funds',
      title: 'Collect your funds',
      description: `We’re holding funds for you. Add a payout method to receive your earnings.`,
      requiredTo: 'Required to pay out',
      href: '/owner/payouts',
      icon: 'card',
      // Only a real step when there is money waiting and nowhere to send it.
      done: heldAmount === 0 || (profile?.payoutMethods.length ?? 0) > 0,
    },
  ];
}
