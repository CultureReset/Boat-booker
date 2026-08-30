import { fromServiceError, ok, readJson, requireOwner, withDb, withMutation } from '@/lib/api/http';
import {
  createInvite,
  directEconomics,
  directSettingsFor,
  disableDirect,
  enableDirect,
  requestReviews,
  reviewCandidates,
  validateManualBooking,
} from '@/lib/services/direct';
import { createBooking } from '@/lib/services/bookings';
import type { InviteChannel } from '@/lib/domain/types';

/** GET — Direct settings, live invites, and the review-request candidates. */
export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const data = await withDb((db) => ({
    settings: directSettingsFor(db, auth.user.id) ?? null,
    invites: db.bookingInvites
      .filter((i) => i.ownerId === auth.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50),
    reviewCandidates: reviewCandidates(db, auth.user.id),
    // Worked on a representative booking value so the saving is concrete
    // rather than a percentage the operator has to apply themselves.
    economics: directEconomics(1000, 'USD'),
  }));

  return ok(data);
}

/** POST — enable/disable, issue an invite, add a manual booking, ask for reviews. */
export async function POST(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    action?: 'enable' | 'disable' | 'invite' | 'manual_booking' | 'request_reviews';
    acceptTerms?: boolean;
    feeBearer?: 'operator' | 'customer';
    charterId?: string;
    channel?: InviteChannel;
    recipient?: string;
    bookingIds?: string[];
    manual?: {
      packageId: string;
      date: string;
      departureTime: string;
      adults: number;
      children: number;
      agreedPrice: number;
      contact: { firstName: string; lastName: string; email: string; phone: string };
      note?: string;
    };
  }>(request);

  try {
    const result = await withMutation((db) => {
      switch (body.action) {
        case 'enable':
          return enableDirect(db, auth.user.id, {
            acceptTerms: Boolean(body.acceptTerms),
            feeBearer: body.feeBearer,
          });

        case 'disable':
          return disableDirect(db, auth.user.id);

        case 'invite':
          return createInvite(db, {
            ownerId: auth.user.id,
            charterId: String(body.charterId ?? ''),
            channel: body.channel ?? 'qr',
            recipient: body.recipient,
          });

        case 'request_reviews':
          return requestReviews(db, auth.user.id, body.bookingIds ?? []);

        case 'manual_booking': {
          const manual = body.manual;
          if (!manual) throw Object.assign(new Error('Missing booking'), { code: 'invalid' });

          validateManualBooking(db, {
            ownerId: auth.user.id,
            charterId: String(body.charterId ?? ''),
            ...manual,
          });

          // A manual booking is confirmed on arrival: the operator has already
          // agreed it with the guest, so it never sits as a request.
          const booking = createBooking(db, {
            charterId: String(body.charterId ?? ''),
            packageId: manual.packageId,
            date: manual.date,
            departureTime: manual.departureTime,
            adults: manual.adults,
            children: manual.children,
            days: 1,
            paymentMode: 'on_arrival',
            currency: db.charters.find((c) => c.id === body.charterId)?.currency ?? 'USD',
            // The operator books on the guest's behalf; the guest account is
            // matched by email if one exists, otherwise the booking carries
            // only the contact details.
            customerId:
              db.users.find((u) => u.email === manual.contact.email.toLowerCase())?.id ??
              auth.user.id,
            contact: manual.contact,
            messageToOwner: manual.note,
            source: 'manual',
          });

          return booking;
        }

        default:
          throw Object.assign(new Error('Unknown action'), { code: 'invalid' });
      }
    });

    return ok(result);
  } catch (error) {
    return fromServiceError(error);
  }
}
