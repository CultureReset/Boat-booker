import { fromServiceError, ok, readJson, requireAuth, withDb, withMutation } from '@/lib/api/http';
import {
  browseCatches,
  inviteBuddies,
  revokeWishlistShare,
  shareWishlist,
  type Season,
} from '@/lib/services/memories';

/** GET /api/social?catches= — the public feed, paged. No session required. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('catches') === null) return ok(null);

  const season = url.searchParams.get('season');
  const result = await withDb((db) =>
    browseCatches(db, {
      season: (season as Season) ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
      page: Number(url.searchParams.get('page')) || 1,
    }),
  );

  return ok(result.catches, { totalCount: result.totalCount, pageCount: result.pageCount });
}

/** POST /api/social — share or revoke a wishlist, invite trip buddies. */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    action?: 'share_wishlist' | 'revoke_wishlist' | 'invite_buddies';
    bookingId?: string;
    emails?: string[];
  }>(request);

  try {
    const result = await withMutation((db) => {
      switch (body.action) {
        case 'share_wishlist':
          return shareWishlist(db, auth.user.id);
        case 'revoke_wishlist':
          revokeWishlistShare(db, auth.user.id);
          return { revoked: true };
        case 'invite_buddies': {
          const booking = inviteBuddies(
            db,
            String(body.bookingId ?? ''),
            auth.user.id,
            body.emails ?? [],
          );
          return { invitations: booking.buddyInvitations };
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
