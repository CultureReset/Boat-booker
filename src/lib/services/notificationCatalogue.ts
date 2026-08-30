import type { NotificationCategory, NotificationChannel } from '@/lib/domain/types';

/**
 * The notification catalogue.
 *
 * Every send in the product names a type from this table, and the table decides
 * the category, the default channels and — crucially — whether the recipient
 * can turn it off. That last column is the reason this is data rather than
 * scattered literals: "can this be muted?" is a policy question, and policy
 * questions belong in one reviewable place.
 *
 * The rule: **anything the recipient must act on is not mutable.** A booking
 * request an operator never sees costs them the trip and their response rate;
 * a payout that needs approving is their money. Marketing, reminders and
 * anything merely nice to know are all opt-out.
 */

export interface NotificationType {
  key: string;
  category: NotificationCategory;
  audience: 'customer' | 'owner' | 'both';
  /** Default channels, before the recipient's preferences narrow them. */
  channels: NotificationChannel[];
  /** False when the recipient must act and cannot be allowed to miss it. */
  optOut: boolean;
  title: string;
  body: string;
}

const T = (
  key: string,
  category: NotificationCategory,
  audience: NotificationType['audience'],
  title: string,
  body: string,
  options: { channels?: NotificationChannel[]; optOut?: boolean } = {},
): NotificationType => ({
  key,
  category,
  audience,
  channels: options.channels ?? ['push', 'email'],
  optOut: options.optOut ?? true,
  title,
  body,
});

export const notificationTypes: NotificationType[] = [
  // --- Booking lifecycle, operator side ------------------------------------
  T('booking_new', 'booking', 'owner', '💸 New booking request', '%name% wants to book %date% for %guests% guests.', { channels: ['push', 'email', 'sms'], optOut: false }),
  T('instant_booking_new', 'booking', 'owner', 'New instant booking', '%package% for %guests% guests on %date%.', { channels: ['push', 'email', 'sms'], optOut: false }),
  T('booking_pending', 'booking', 'owner', 'A customer is waiting on you', 'A booking request has been open %hours% hours. Reply to keep your response rate up.', { optOut: false }),
  T('booking_request_expired', 'booking', 'owner', '🔻 Your ranking was affected', '%name%’s request for %date% expired without a reply.', { optOut: false }),
  T('booking_canceled_by_customer_captain', 'booking', 'owner', 'Booking canceled', '%name% canceled booking #%reference% for %date%.', { optOut: false }),
  T('booking_change_requested_captain', 'booking', 'owner', 'Booking change requested', 'The customer asked to change booking #%reference%.', { optOut: false }),
  T('remainingBalancePaymentMadeCaptain', 'payout', 'owner', '💰 Remaining balance paid', '%name% paid the balance of %amount%.'),
  T('tipPaymentMadeCaptain', 'payout', 'owner', '💰 %name% sent a tip!', '%amount% for the trip on %date%.'),
  T('invoice_reminder', 'payout', 'owner', 'Action required: approve payout', '%item%. Total: %amount%.', { optOut: false }),
  T('new_review_captain', 'review', 'owner', 'New review', '%name% just reviewed %charter%.'),
  T('instant_book_disabled', 'system', 'owner', 'Instant Book deactivated', 'Instant Book is off until %date%.', { optOut: false }),
  T('instant_book_cancellation_reviewed', 'system', 'owner', 'Instant Book status reviewed', '%strikes%/4 penalty strikes on your account.', { optOut: false }),
  T('availability_reminder', 'onboarding', 'owner', 'Update your availability', 'Block out unavailable dates so you stay visible in search results.'),
  T('report_reminder', 'marketing', 'owner', 'How was the water today?', 'Let boaters know what conditions were like.', { channels: ['push'] }),
  T('trip_reminder_captain', 'booking', 'owner', 'Trip coming up', 'You have a trip on %date%.'),

  // --- Booking lifecycle, guest side ---------------------------------------
  T('booking_accepted_customer', 'booking', 'customer', 'Booking confirmed', 'Capt. %captain% accepted your request for %charter% on %date%.', { channels: ['push', 'email', 'sms'], optOut: false }),
  T('booking_declined_customer', 'booking', 'customer', 'Booking declined', 'Your request for %charter% was declined. Find another boat for %date%.', { optOut: false }),
  T('booking_canceled_by_captain_customer', 'booking', 'customer', 'Booking canceled', 'Capt. %captain% canceled your trip on %date%: “%reason%”.', { optOut: false }),
  T('booking_change_requested_customer', 'booking', 'customer', 'Changes requested', 'Your captain wants to change your booking with %charter%.', { optOut: false }),
  T('booking_change_accepted', 'booking', 'both', 'Changes accepted', 'Booking #%reference% has been updated.'),
  T('booking_change_declined', 'booking', 'both', 'Changes declined', 'Booking #%reference% stays as it was.'),
  T('booking_change_expired', 'booking', 'both', 'Changes expired', 'Nobody responded in time, so the original booking stands.'),
  T('booking_change_withdrawn', 'booking', 'both', 'Change request withdrawn', 'Booking #%reference% is unchanged.'),
  T('trip_reminder_customer', 'booking', 'customer', 'Fair winds', 'Your trip with %charter% is coming up. Have fun!'),
  T('payment_link_created', 'booking', 'customer', 'Pay remaining balance', 'Your captain has requested the remaining balance for %date%.', { optOut: false }),
  T('remainingBalanceScheduledPaymentReminder', 'booking', 'customer', 'Balance payment coming up', 'We’ll charge %amount% for your trip with %charter% soon.'),
  T('remainingBalanceScheduledPaymentFailed', 'booking', 'customer', 'Scheduled payment failed', 'We could not charge %amount% for your trip with %charter%.', { optOut: false }),
  T('review_approved_customer', 'review', 'customer', 'Review approved', 'Your review of %charter% is live.'),
  T('review_reply_added_customer', 'review', 'customer', 'Review reply', 'Capt. %captain% replied to your review of %charter%.'),
  T('review_requested_customer', 'review', 'customer', 'How was your trip?', 'Leave a review of %charter% — it takes a minute.'),

  // --- Offers and inquiries -------------------------------------------------
  T('offer_sent_customer', 'booking', 'customer', 'New trip offer', 'Capt. %captain% sent you an offer for %charter% on %date%.', { optOut: false }),
  T('offer_reminder_customer', 'booking', 'customer', 'Offer reminder', 'You have until %time% on %date% to book your offer.'),
  T('offer_last_reminder_customer', 'booking', 'customer', 'Last chance to book', 'Your offer for %charter% expires at %time%.'),
  T('offer_expired_customer', 'booking', 'customer', 'Offer expired', 'The captain’s offer for %date% has expired.'),
  T('offer_withdrawn_customer', 'booking', 'customer', 'Offer withdrawn', 'The captain withdrew their offer for %date%.'),
  T('inquiry_received_captain', 'message', 'owner', 'A customer sent you an inquiry', '%name% asked about %charter%.', { optOut: false }),
  T('inquiry_pre_approved_customer', 'message', 'customer', 'Inquiry pre-approved', '%charter% is available — book while the date is open.'),
  T('inquiry_declined_customer', 'message', 'customer', 'Inquiry declined', 'Unfortunately the captain is unavailable for those dates.'),

  // --- Messaging ------------------------------------------------------------
  T('im_new_message', 'message', 'both', 'New message from %name%', '%preview%'),
  T('im_new_photo', 'message', 'both', 'New photo from %name%', '%name% sent you a photo.'),
  T('bypassWarning', 'system', 'both', 'Message blocked', 'A message you tried to send violates our communication policy.', { optOut: false }),

  // --- Lifecycle and marketing ---------------------------------------------
  T('cart_abandonment_1', 'marketing', 'customer', '%name%, lock in your trip with %charter% 🚤', 'Finish your booking and get ready to make some memories.', { channels: ['push', 'email'] }),
  T('cart_abandonment_2', 'marketing', 'customer', 'Still thinking about %charter%?', 'Your dates are still open — for now.', { channels: ['email'] }),
  T('book_again_after_trip', 'marketing', 'customer', '%name%, another day on the water in %location%? 🚤', 'You’re already in the right spot. See what else is available.', { channels: ['push'] }),
  T('book_additional_trip', 'marketing', 'customer', '%name%, how about another day out? 🚤', 'One time is never enough. Pick your next date.', { channels: ['push'] }),
  T('trip_anniversary', 'marketing', 'customer', '%name%, it’s your boataversary today 🚤', 'Time for another adventure — see what’s available.', { channels: ['push'] }),
  T('trip_memory_ready', 'marketing', 'customer', 'Your trip memory is ready', 'We’ve put together the best bits of your trip with %charter%.', { channels: ['push'] }),
  T('referral_credit_earned', 'marketing', 'customer', 'You’ve earned credit', '%name% took their first trip. %amount% is waiting on your next booking.'),

  // --- Account and onboarding ----------------------------------------------
  T('email_verify', 'onboarding', 'both', 'Confirm your email', 'Confirm your email to unlock your full account.', { channels: ['email'], optOut: false }),
  T('onboarding_complete_listing', 'onboarding', 'owner', 'Finish your listing', 'Add your boat details and photos so customers can book you.'),
  T('onboarding_get_verified', 'onboarding', 'owner', 'Get verified', 'Upload your credentials so your listing goes live.'),
  T('payout_method_missing', 'onboarding', 'owner', 'Add a payout method', 'We’re holding funds for you. Tell us where to send them.', { optOut: false }),
  T('listing_suspended', 'system', 'owner', 'Your listing has been paused', '%reason%. See details to reactivate.', { optOut: false }),
  T('listing_booking_limit', 'system', 'owner', 'Booking limit reached', '%current%/%limit% — %reason%.', { optOut: false }),
  T('product_update', 'product_update', 'both', '%title%', '%body%', { channels: ['push'] }),
  T('support_reply', 'ticket', 'both', 'Support replied', 'Request #%number%: %preview%', { optOut: false }),
];

const BY_KEY = new Map(notificationTypes.map((type) => [type.key, type]));

export function notificationType(key: string): NotificationType | undefined {
  return BY_KEY.get(key);
}

/** Whether a recipient is allowed to mute this type at all. */
export function isMutable(key: string): boolean {
  return notificationType(key)?.optOut ?? true;
}

/**
 * Preference rows for the settings screen, grouped by category.
 *
 * Built from the catalogue rather than hand-listed so a new notification type
 * cannot ship without appearing in the place people go to turn it off.
 */
export interface PreferenceGroup {
  category: NotificationCategory;
  title: string;
  description: string;
  channels: NotificationChannel[];
  /** True when nothing in this group can be muted. */
  alwaysOn: boolean;
  typeCount: number;
}

const CATEGORY_COPY: Record<NotificationCategory, { title: string; description: string }> = {
  booking: {
    title: 'Bookings and trips',
    description: 'Requests, confirmations, changes, cancellations and trip reminders.',
  },
  message: { title: 'Messages', description: 'New messages and inquiries from the other party.' },
  review: { title: 'Reviews', description: 'New reviews, replies and review requests.' },
  payout: { title: 'Payments and payouts', description: 'Balances, tips and payout approvals.' },
  onboarding: { title: 'Getting set up', description: 'Steps still needed to publish or get paid.' },
  product_update: { title: 'Product updates', description: 'New features and changes worth knowing about.' },
  ticket: { title: 'Support', description: 'Replies from our support team.' },
  marketing: { title: 'Offers and inspiration', description: 'Deals, reminders and ideas for your next trip.' },
  system: { title: 'Account and safety', description: 'Policy, security and account health.' },
};

export function preferenceGroups(audience: 'customer' | 'owner'): PreferenceGroup[] {
  const relevant = notificationTypes.filter(
    (type) => type.audience === audience || type.audience === 'both',
  );

  const categories = [...new Set(relevant.map((type) => type.category))];

  return categories.map((category) => {
    const inCategory = relevant.filter((type) => type.category === category);
    return {
      category,
      ...CATEGORY_COPY[category],
      channels: [...new Set(inCategory.flatMap((type) => type.channels))],
      alwaysOn: inCategory.every((type) => !type.optOut),
      typeCount: inCategory.length,
    };
  });
}

/** Fills a catalogue template with values, leaving unknown slots visible. */
export function renderNotification(
  key: string,
  values: Record<string, string | number>,
): { title: string; body: string } | undefined {
  const type = notificationType(key);
  if (!type) return undefined;

  const fill = (template: string) =>
    template.replace(/%(\w+)%/g, (match, name: string) =>
      values[name] === undefined ? match : String(values[name]),
    );

  return { title: fill(type.title), body: fill(type.body) };
}
