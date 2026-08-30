import { reviewCriteria } from '@/config/taxonomy';
import { newId } from '@/lib/core/ids';
import type { Database, Review } from '@/lib/domain/types';
import { notify } from './bookings';

/**
 * Reviews.
 *
 * A review can only exist against a completed booking made by the reviewer,
 * and only one per booking. That rule is enforced here rather than in the UI,
 * so the API cannot be used to manufacture ratings.
 */

export class ReviewError extends Error {
  constructor(
    readonly code: 'not_found' | 'forbidden' | 'not_completed' | 'already_reviewed' | 'invalid',
    message: string,
  ) {
    super(message);
    this.name = 'ReviewError';
  }
}

export interface CreateReviewInput {
  bookingId: string;
  customerId: string;
  headline: string;
  body: string;
  ratings: Record<string, number>;
}

export function createReview(db: Database, input: CreateReviewInput): Review {
  const booking = db.bookings.find((b) => b.id === input.bookingId);
  if (!booking) throw new ReviewError('not_found', 'Booking not found');
  if (booking.customerId !== input.customerId) throw new ReviewError('forbidden', 'Not your booking');
  if (booking.status !== 'completed') {
    throw new ReviewError('not_completed', 'You can review a trip once it has happened');
  }
  if (booking.reviewId) throw new ReviewError('already_reviewed', 'This trip is already reviewed');

  const headline = input.headline.trim();
  const body = input.body.trim();
  if (headline.length < 3 || body.length < 10) {
    throw new ReviewError('invalid', 'Please add a headline and a few words about the trip');
  }

  // Every criterion must be a whole 1–5; anything else is rejected rather than
  // silently clamped, so a broken client cannot skew aggregates quietly.
  const ratings: Record<string, number> = {};
  for (const criterion of reviewCriteria) {
    const value = Number(input.ratings[criterion.key]);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new ReviewError('invalid', `Rate ${criterion.title} from 1 to 5`);
    }
    ratings[criterion.key] = value;
  }

  const average =
    reviewCriteria.reduce((sum, c) => sum + ratings[c.key], 0) / reviewCriteria.length;

  const review: Review = {
    id: newId(),
    charterId: booking.charterId,
    bookingId: booking.id,
    customerId: booking.customerId,
    ownerId: booking.ownerId,
    headline: headline.slice(0, 120),
    body: body.slice(0, 4000),
    ratings: ratings as Review['ratings'],
    rating: Number(average.toFixed(2)),
    createdAt: new Date().toISOString(),
  };

  db.reviews.push(review);
  booking.reviewId = review.id;

  notify(db, booking.ownerId, {
    kind: 'review',
    title: 'New review',
    body: `${review.rating.toFixed(1)}★ — “${review.headline}”`,
    href: `/owner/reviews`,
  });

  return review;
}

export function respondToReview(
  db: Database,
  reviewId: string,
  ownerId: string,
  response: string,
): Review {
  const review = db.reviews.find((r) => r.id === reviewId);
  if (!review) throw new ReviewError('not_found', 'Review not found');
  if (review.ownerId !== ownerId) throw new ReviewError('forbidden', 'Not your review');

  const trimmed = response.trim();
  if (trimmed.length < 2) throw new ReviewError('invalid', 'Write a short response');

  review.ownerResponse = trimmed.slice(0, 2000);
  review.ownerRespondedAt = new Date().toISOString();

  notify(db, review.customerId, {
    kind: 'review',
    title: 'The owner replied to your review',
    body: trimmed.slice(0, 120),
    href: `/account/reviews`,
  });

  return review;
}

export interface ExpandedReview {
  id: string;
  headline: string;
  body: string;
  rating: number;
  ratings: Record<string, number>;
  createdAt: string;
  author: { displayName: string; initials: string };
  charter: { id: string; title: string } | null;
  tripDate: string | null;
  ownerResponse?: string;
  ownerRespondedAt?: string;
  verified: boolean;
}

export function expandReview(db: Database, review: Review): ExpandedReview {
  const customer = db.users.find((u) => u.id === review.customerId);
  const charter = db.charters.find((c) => c.id === review.charterId);
  const booking = db.bookings.find((b) => b.id === review.bookingId);

  // Guests are shown by first name and last initial, as on the live product.
  const displayName = customer
    ? `${customer.firstName} ${customer.lastName.charAt(0)}.`
    : 'Guest';

  return {
    id: review.id,
    headline: review.headline,
    body: review.body,
    rating: review.rating,
    ratings: review.ratings,
    createdAt: review.createdAt,
    author: {
      displayName,
      initials: `${customer?.firstName?.[0] ?? 'G'}${customer?.lastName?.[0] ?? ''}`.toUpperCase(),
    },
    charter: charter ? { id: charter.id, title: charter.title } : null,
    tripDate: booking?.date ?? null,
    ownerResponse: review.ownerResponse,
    ownerRespondedAt: review.ownerRespondedAt,
    verified: Boolean(booking),
  };
}

export function reviewsForCharter(
  db: Database,
  charterId: string,
  options: { page?: number; perPage?: number; sort?: 'newest' | 'highest' | 'lowest' } = {},
) {
  const { page = 1, perPage = 10, sort = 'newest' } = options;

  const all = db.reviews.filter((r) => r.charterId === charterId);
  const sorted = [...all].sort((a, b) => {
    if (sort === 'highest') return b.rating - a.rating;
    if (sort === 'lowest') return a.rating - b.rating;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / perPage));
  const current = Math.min(Math.max(1, page), pageCount);

  return {
    reviews: sorted.slice((current - 1) * perPage, current * perPage).map((r) => expandReview(db, r)),
    metadata: { page: current, perPage, pageCount, totalCount: sorted.length },
  };
}
