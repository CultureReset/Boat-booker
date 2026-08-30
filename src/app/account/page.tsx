import { redirect } from 'next/navigation';

/** `/account` has no landing screen of its own — bookings is the useful default. */
export default function AccountIndex() {
  redirect('/account/bookings');
}
