import { brand, commerceConfig } from '@/config/brand';

/**
 * Static page content.
 *
 * Kept as data rather than JSX so the same pages can be rendered by the web
 * app, served through the API to the mobile shell, or handed to a CMS later
 * without rewriting any components. Every page here is real, readable copy —
 * a policy page that says "lorem ipsum" is worse than no policy page.
 */

export interface PageSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Renders as a numbered list rather than bullets. */
  steps?: { title: string; body: string }[];
}

export interface StaticPage {
  slug: string;
  title: string;
  subtitle?: string;
  updated?: string;
  sections: PageSection[];
}

const fee = Math.round(commerceConfig.serviceFeeRate * 100);

export const staticPages: StaticPage[] = [
  // ------------------------------------------------------------------ about
  {
    slug: 'about',
    title: `About ${brand.name}`,
    subtitle: 'A marketplace for time on the water.',
    sections: [
      {
        paragraphs: [
          `${brand.name} connects people who want a day on the water with the operators who run the boats. We are not a boat owner or a tour company: every trip listed here belongs to an independent business, and every booking is between you and them.`,
          'What we do is the part that used to be painful — finding out who actually has a boat free on your date, at your group size, for a price you can see before you commit.',
        ],
      },
      {
        heading: 'What we check',
        bullets: [
          'That an operator is a real, contactable business before a listing goes live.',
          'Licence and insurance documents, where the operator has submitted them for verification.',
          'That reviews come only from guests who genuinely booked and travelled.',
          'That availability is maintained, so a listing you can book is a listing that is free.',
        ],
      },
      {
        heading: 'How we make money',
        paragraphs: [
          `We take a ${fee}% service fee on each booking. It is shown as its own line in every price breakdown before you pay — there is no version of this platform where you find a fee at the end that was not on the page at the start.`,
          'Operators pay nothing to list, and nothing when a trip does not happen.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- careers
  {
    slug: 'careers',
    title: 'Careers',
    subtitle: 'We are a small team building for people who work on the water.',
    sections: [
      {
        paragraphs: [
          'We hire people who like specifics: what a captain actually does at 6am, why a booking fell through, which line of the price breakdown confused someone. The work is closer to the water than most software jobs.',
        ],
      },
      {
        heading: 'How we work',
        bullets: [
          'Small teams that own a whole surface, from the database to the button.',
          'Written proposals over meetings; a decision is not made until it is written down.',
          'Support rotation for everyone — you will talk to captains and guests.',
          'Remote-first across compatible timezones, with time on boats built into onboarding.',
        ],
      },
      {
        heading: 'Open roles',
        paragraphs: [
          `We publish open roles as they come up. If nothing fits but you think you should be here, write to ${brand.supportEmail} and tell us what you would fix first.`,
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- contact
  {
    slug: 'contact',
    title: 'Contact',
    subtitle: 'Support, seven days a week.',
    sections: [
      {
        heading: 'Guests',
        paragraphs: [
          `For anything about a booking you have made, the fastest route is the message thread on the booking itself — your operator sees it immediately. For everything else, call ${brand.supportPhone} or email ${brand.supportEmail}.`,
        ],
      },
      {
        heading: 'Operators',
        paragraphs: [
          'Listing questions, payouts and verification all go through your dashboard, where we can see your account alongside the question. Urgent day-of issues should go to the support line.',
        ],
      },
      {
        heading: 'In an emergency',
        paragraphs: [
          'If you are on the water and something is wrong, call your local emergency number first. Contact us afterwards and we will deal with the booking.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------- why list
  {
    slug: 'whylist',
    title: `List your business on ${brand.name}`,
    subtitle: 'Find customers and earn more.',
    sections: [
      {
        paragraphs: [
          'You already have the boat, the licence and the local knowledge. What most operators do not have is a steady stream of people who can find them, see real availability, and book without a phone call.',
        ],
      },
      {
        heading: 'What it costs',
        paragraphs: [
          `Nothing to list. We take ${fee}% of each completed booking. If a trip does not run, you owe nothing.`,
        ],
      },
      {
        heading: 'How it works',
        steps: [
          { title: 'Create your listing', body: 'Add the boat, your trips, your photos and your rules. It stays a draft until you publish it.' },
          { title: 'Set your availability', body: 'Block the days you are out. The multicalendar handles a whole fleet at once.' },
          { title: 'Take bookings', body: 'Accept requests yourself, or turn on Instant Book and let guests confirm directly.' },
          { title: 'Get paid', body: 'Payouts clear two days after the trip, to the bank account or PayPal address you nominate.' },
        ],
      },
      {
        heading: 'What you control',
        bullets: [
          'Your prices, per trip and per group size.',
          'Your cancellation window and deposit.',
          'Whether guests book instantly or wait for you to confirm.',
          'Which payment methods you accept, online or on arrival.',
          'Who on your team can see the calendar and respond to bookings.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- safety
  {
    slug: 'safety',
    title: 'Safety',
    subtitle: 'What we check, what your operator must carry, and what to do on the day.',
    sections: [
      {
        heading: 'Before you book',
        bullets: [
          'Look for the verification badge — it means the operator has submitted licence and insurance documents that our team has reviewed.',
          'Read the boat rules on the listing. Whether children are allowed, whether swimming is part of the trip, and what is provided are all stated there.',
          'Check the capacity against your actual group. An operator cannot legally exceed it, and will turn people away at the dock.',
          'Message the operator with anything that matters — mobility, allergies, non-swimmers, very young children.',
        ],
      },
      {
        heading: 'What every operator must have',
        bullets: [
          'Correctly sized life jackets for every person on board, including children.',
          'The licence required for the waters they run in and the size of vessel they operate.',
          'Liability insurance appropriate to the trip.',
          'A safety briefing before leaving the dock.',
        ],
      },
      {
        heading: 'On the day',
        bullets: [
          'Arrive fifteen minutes early. Boats leave on the tide and the weather, not the clock.',
          'Listen to the safety briefing even if you have heard one before — every boat is laid out differently.',
          'The captain has final say on the route and on whether the trip runs at all. If they call it off for weather, they are doing their job.',
          'Alcohol and open water are a bad combination for anyone who might need to swim. Operators can and do refuse boarding.',
        ],
      },
      {
        heading: 'If the weather turns',
        paragraphs: [
          'If your operator cannot run the trip safely, your booking is moved to another date or cancelled free of charge, whatever the listing’s normal cancellation policy says. That protection is not optional for operators on this platform.',
        ],
      },
      {
        heading: 'In an emergency',
        paragraphs: [
          `Call your local emergency number first — coastguard, or the equivalent where you are. Then contact us on ${brand.supportPhone} so we can help with the booking.`,
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- terms
  {
    slug: 'terms',
    title: 'Terms of Use',
    updated: 'Last updated 1 August 2026',
    sections: [
      {
        heading: '1. What this platform is',
        paragraphs: [
          `${brand.legalName} operates a marketplace connecting guests with independent boat operators. We are not a party to the trip itself. The contract for the trip is between you and the operator; our contract with you covers the use of this platform.`,
        ],
      },
      {
        heading: '2. Your account',
        bullets: [
          'You must be old enough to enter a contract in your jurisdiction to book.',
          'You are responsible for what happens under your account, including keeping your credentials private.',
          'The details you give an operator — names, group size, contact number — must be accurate. Operators rely on them for safety and capacity.',
        ],
      },
      {
        heading: '3. Bookings and payment',
        bullets: [
          `Prices shown include our ${fee}% service fee, itemised separately in the breakdown.`,
          'A booking is confirmed either instantly, where the operator has enabled Instant Book, or when the operator accepts your request.',
          'Where a deposit is taken at booking, the balance is due to the operator as stated on the listing.',
          'A refundable security deposit, where one applies, is collected and returned by the operator directly.',
        ],
      },
      {
        heading: '4. Cancellations',
        bullets: [
          'Each listing states its own free-cancellation window. Inside that window, cancelling returns what you paid at booking.',
          'Outside that window, the deposit is not refundable.',
          'If the operator cancels — including for unsafe weather — you may move the booking or cancel free of charge.',
          'If an operator does not respond to a request within the response window, the request expires and nothing is charged.',
        ],
      },
      {
        heading: '5. Reviews',
        paragraphs: [
          'Reviews may only be left by guests who booked and completed a trip. We remove reviews that identify people, contain abuse, or are demonstrably not about the trip. We do not remove a review for being negative.',
        ],
      },
      {
        heading: '6. Operator obligations',
        bullets: [
          'Hold and maintain the licences and insurance required where you operate.',
          'Keep availability accurate. A listing that cannot honour its calendar damages every operator here.',
          'Honour the price and the trip as listed at the time of booking.',
          'Never take a booking off-platform to avoid the service fee after a guest has found you here.',
        ],
      },
      {
        heading: '7. Liability',
        paragraphs: [
          'To the extent permitted by law, our liability relating to a trip is limited to the amount you paid through the platform for that booking. Nothing here limits liability for death or personal injury caused by negligence, or for fraud.',
        ],
      },
      {
        heading: '8. Changes',
        paragraphs: [
          'We may change these terms. Material changes are notified to registered users before they take effect, and bookings already confirmed continue under the terms that applied when they were made.',
        ],
      },
    ],
  },

  // --------------------------------------------------------------- privacy
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    updated: 'Last updated 1 August 2026',
    sections: [
      {
        heading: 'What we collect',
        bullets: [
          'Account details: name, email, phone number, and the preferences you set.',
          'Booking details: trips, dates, group sizes, and the messages you exchange with an operator.',
          'Payment details: the brand and last four digits of a card. We never store a full card number.',
          'Technical data: IP address, device type and pages viewed, used to keep the service working and secure.',
        ],
      },
      {
        heading: 'Why we use it',
        bullets: [
          'To take and manage your bookings, which is the service you asked for.',
          'To let you and your operator communicate about a trip.',
          'To prevent fraud and abuse.',
          'To send you service messages about your bookings. Marketing email is separate and opt-in.',
        ],
      },
      {
        heading: 'What we share',
        paragraphs: [
          'When you book, the operator receives the contact details and group information they need to run the trip. They are independent businesses and are responsible for their own handling of that data.',
          'We use processors for payments, email delivery and infrastructure. We do not sell personal data.',
        ],
      },
      {
        heading: 'How long we keep it',
        paragraphs: [
          'Booking and payment records are kept as long as tax and accounting rules require. Everything else is deleted or anonymised when you close your account.',
        ],
      },
      {
        heading: 'Your choices',
        bullets: [
          'Edit or correct your details at any time in your account settings.',
          'Turn off marketing email without affecting booking notifications.',
          'Delete your account, which anonymises your profile and removes your saved cards and wishlist.',
          `Ask for a copy of your data, or ask us to erase it, by writing to ${brand.supportEmail}.`,
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ gdpr
  {
    slug: 'gdpr',
    title: 'GDPR Privacy Notice',
    updated: 'Last updated 1 August 2026',
    sections: [
      {
        paragraphs: [
          'This notice supplements our Privacy Policy for people in the European Economic Area and the United Kingdom.',
        ],
      },
      {
        heading: 'Controller',
        paragraphs: [
          `${brand.legalName} is the controller for the personal data described in our Privacy Policy. Contact ${brand.supportEmail} for any request under this notice.`,
        ],
      },
      {
        heading: 'Lawful bases',
        bullets: [
          'Performance of a contract — taking and managing your bookings.',
          'Legitimate interests — fraud prevention, security, and improving the service.',
          'Consent — marketing email and non-essential analytics, which you may withdraw at any time.',
          'Legal obligation — tax, accounting and where we must respond to lawful requests.',
        ],
      },
      {
        heading: 'Your rights',
        bullets: [
          'Access a copy of the personal data we hold about you.',
          'Correct data that is inaccurate.',
          'Erase data where we have no overriding basis to keep it.',
          'Restrict or object to processing based on legitimate interests.',
          'Receive your data in a portable format.',
          'Complain to your national supervisory authority.',
        ],
      },
      {
        heading: 'Transfers',
        paragraphs: [
          'Where data is transferred outside the EEA or UK, we rely on adequacy decisions or standard contractual clauses, together with technical measures appropriate to the data involved.',
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- rules
  {
    slug: 'rules',
    title: 'Platform Rules and Guidelines',
    sections: [
      {
        paragraphs: [
          'These rules apply to everyone using the platform. They exist so that a listing means what it says and a review can be trusted.',
        ],
      },
      {
        heading: 'For guests',
        bullets: [
          'Give accurate group numbers. Capacity is a legal limit, not a guideline, and an operator will turn away extra people.',
          'Turn up on time. A boat that waits for one group ruins the day for the next.',
          'Follow the captain’s instructions. On the water their authority is not negotiable.',
          'Keep communication on-platform until a booking is confirmed — it is the only record we can help with if something goes wrong.',
        ],
      },
      {
        heading: 'For operators',
        bullets: [
          'List only boats you actually operate and are licensed for.',
          'Keep photos current. A photo of a boat you no longer own is a listing we will remove.',
          'Keep your calendar accurate and respond to requests within the response window.',
          'Honour confirmed bookings. Cancelling on a guest is the most damaging thing an operator can do here, and repeated cancellations end the account.',
          'Do not ask guests to book off-platform to avoid the service fee.',
        ],
      },
      {
        heading: 'Reviews',
        bullets: [
          'Only guests who completed a trip can review it.',
          'Reviews must describe the trip, not a dispute about a refund.',
          'No personal information about crew or other guests.',
          'Operators may respond publicly once per review. They may not offer anything in exchange for changing it.',
        ],
      },
      {
        heading: 'Enforcement',
        paragraphs: [
          'We warn first where a rule is broken by accident, and remove listings or accounts where it is not. Safety breaches and confirmed fraud skip the warning.',
        ],
      },
    ],
  },

  // --------------------------------------------------------- accessibility
  {
    slug: 'accessibility',
    title: 'Accessibility Statement',
    updated: 'Last updated 1 August 2026',
    sections: [
      {
        paragraphs: [
          `${brand.name} aims to meet WCAG 2.2 Level AA. Accessibility is treated as part of building a feature, not a pass made afterwards.`,
        ],
      },
      {
        heading: 'What we do',
        bullets: [
          'Every interactive control is reachable and operable by keyboard, with a visible focus indicator.',
          'Form fields have real labels, and errors are announced rather than only coloured red.',
          'Dialogs trap focus while open and return it to the control that opened them.',
          'Text meets contrast requirements against its background in both light and dark rendering.',
          'Motion respects the operating system’s reduced-motion preference.',
          'Touch targets are at least 44px on mobile.',
        ],
      },
      {
        heading: 'Booking a boat with access needs',
        paragraphs: [
          'Listings state whether a boat is wheelchair accessible, and the amenity list covers boarding platforms and swim ladders. Where the listing does not answer your question, message the operator before booking — they know their own boat better than any filter.',
        ],
      },
      {
        heading: 'Telling us about a problem',
        paragraphs: [
          `If something on this site is not usable for you, email ${brand.supportEmail} with the page and what happened. We treat accessibility defects as bugs, not requests.`,
        ],
      },
    ],
  },
];

export const staticPageBySlug = new Map(staticPages.map((page) => [page.slug, page]));
