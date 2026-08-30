import { fromServiceError, ok, readJson, requireOwner, withMutation } from '@/lib/api/http';
import { currencyByCode } from '@/config/locale';
import { publicUser } from '@/lib/auth/session';

/**
 * PATCH /api/owner/settings — business profile fields on the owner account.
 *
 * Listing-level policy (deposit, cancellation, instant book) lives on each
 * listing, not here, so an owner can run different rules per boat.
 */
export async function PATCH(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    companyName?: string;
    captainName?: string;
    background?: string;
    experience?: string;
    languages?: string;
    yearStartedRunningCharters?: number;
    onlinePaymentsEnabled?: boolean;
    currency?: string;
    timezone?: string;
    phone?: string;
  }>(request);

  try {
    const user = await withMutation((db) => {
      const target = db.users.find((u) => u.id === auth.user.id);
      if (!target?.ownerProfile) {
        throw Object.assign(new Error('Owner account required'), { code: 'forbidden' });
      }

      const profile = target.ownerProfile;

      if (body.companyName !== undefined) {
        const value = body.companyName.trim();
        if (value.length < 2) throw Object.assign(new Error('Enter your business name'), { code: 'invalid' });
        profile.companyName = value.slice(0, 120);
      }
      if (body.captainName !== undefined) profile.captainName = body.captainName.trim().slice(0, 120);
      if (body.background !== undefined) profile.background = body.background.trim().slice(0, 4000);
      if (body.experience !== undefined) profile.experience = body.experience.trim().slice(0, 400);
      if (body.languages !== undefined) profile.languages = body.languages.trim().slice(0, 200);

      if (body.yearStartedRunningCharters !== undefined) {
        const year = Number(body.yearStartedRunningCharters);
        const thisYear = new Date().getFullYear();
        if (Number.isInteger(year) && year >= 1900 && year <= thisYear) {
          profile.yearStartedRunningCharters = year;
        }
      }

      if (body.onlinePaymentsEnabled !== undefined) {
        profile.onlinePaymentsEnabled = Boolean(body.onlinePaymentsEnabled);
      }

      if (body.currency && currencyByCode.has(body.currency.toUpperCase())) {
        target.currency = body.currency.toUpperCase();
      }
      if (body.timezone) target.timezone = body.timezone.slice(0, 64);
      if (body.phone !== undefined) target.phone = body.phone.trim().slice(0, 40);

      return target;
    });

    return ok({ user: publicUser(user) });
  } catch (error) {
    return fromServiceError(error);
  }
}
