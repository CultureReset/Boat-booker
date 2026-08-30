import Link from 'next/link';
import type { Metadata } from 'next';
import { brand, commerceConfig } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/primitives';
import { HelpSearch } from '@/components/content/HelpSearch';

export const metadata: Metadata = {
  title: t('navigation', 'helpCenter'),
  description: `Answers about booking, cancelling, paying and listing on ${brand.name}.`,
  alternates: { canonical: '/help' },
};

/**
 * Help centre.
 *
 * Articles are data so the same set can be searched client-side, rendered
 * here, and later served to the mobile shell without duplication.
 */
export interface HelpArticle {
  id: string;
  category: 'booking' | 'payments' | 'cancellations' | 'account' | 'owners' | 'safety';
  question: string;
  answer: string[];
}

const fee = Math.round(commerceConfig.serviceFeeRate * 100);

export const helpArticles: HelpArticle[] = [
  {
    id: 'how-booking-works',
    category: 'booking',
    question: 'How does booking work?',
    answer: [
      'Search for a destination and date, pick a trip on a listing, and check out. Listings marked Instant Book confirm immediately.',
      `Everything else sends a request to the operator, who has ${commerceConfig.inquiryResponseWindowHours} hours to accept. You are not charged until they do.`,
    ],
  },
  {
    id: 'group-size',
    category: 'booking',
    question: 'What if my group is bigger than the boat allows?',
    answer: [
      'Capacity is a legal limit and operators cannot exceed it — extra people will be turned away at the dock.',
      'Filter by capacity in search, or book two boats with the same operator and ask them to run together.',
    ],
  },
  {
    id: 'children',
    category: 'booking',
    question: 'Can I bring children?',
    answer: [
      'Each listing states whether children are allowed under Boat rules.',
      'Tell the operator the ages when you book so they have correctly sized life jackets ready.',
    ],
  },
  {
    id: 'what-to-bring',
    category: 'booking',
    question: 'What should I bring?',
    answer: [
      'Sunscreen, a hat, and a soft-sided bag — hard cases are awkward to stow.',
      'The listing says what is provided. Where food and drink are not included, most operators are happy for you to bring your own.',
    ],
  },
  {
    id: 'price-breakdown',
    category: 'payments',
    question: 'What is in the price?',
    answer: [
      `The trip price, our ${fee}% service fee, and — where you pay online — a card processing fee. Every line is itemised before you pay.`,
      'A refundable security deposit, where one applies, is collected by the operator on arrival and returned after the trip. It is never part of the total.',
    ],
  },
  {
    id: 'deposit',
    category: 'payments',
    question: 'Why am I only charged part of the price?',
    answer: [
      'Many operators take a deposit at booking and the balance on the day. The split is shown at checkout as "due now" and "due on arrival".',
      'You can choose to pay in full online instead, where the operator accepts online payment.',
    ],
  },
  {
    id: 'cancel-booking',
    category: 'cancellations',
    question: 'How do I cancel?',
    answer: [
      'Open the booking in My Bookings and choose Cancel booking. The exact refund is shown before you confirm.',
      'Inside the listing’s free-cancellation window you get back what you paid at booking. Outside it, the deposit is not refundable.',
    ],
  },
  {
    id: 'weather',
    category: 'cancellations',
    question: 'What happens if the weather is bad?',
    answer: [
      'The captain decides whether it is safe to sail. If they cancel, you can move the booking to another date or cancel free of charge — regardless of the listing’s normal policy.',
      'That protection applies to every listing on the platform.',
    ],
  },
  {
    id: 'operator-cancels',
    category: 'cancellations',
    question: 'What if the operator cancels?',
    answer: [
      'You are refunded in full, and we will help you find an alternative for the same dates.',
      'Repeated cancellations by an operator end their account here.',
    ],
  },
  {
    id: 'change-email',
    category: 'account',
    question: 'How do I change my email or password?',
    answer: [
      'Both are in Settings under your account. Changing your password signs out every other device.',
    ],
  },
  {
    id: 'delete-account',
    category: 'account',
    question: 'How do I delete my account?',
    answer: [
      'Settings → Delete account. Your profile is anonymised and your saved cards and wishlist are removed.',
      'Booking and payment records are kept as long as tax rules require.',
    ],
  },
  {
    id: 'loyalty',
    category: 'account',
    question: 'How does the loyalty discount work?',
    answer: [
      'Complete trips and you move up the tiers, each of which applies a percentage discount automatically at checkout.',
      'The discount is shown as its own line in the price breakdown.',
    ],
  },
  {
    id: 'list-boat',
    category: 'owners',
    question: 'How do I list my boat?',
    answer: [
      'Create an owner account, add a listing, set your trips and availability, then publish. Listing is free.',
      `We take ${fee}% of each completed booking, and nothing when a trip does not run.`,
    ],
  },
  {
    id: 'payouts',
    category: 'owners',
    question: 'When do I get paid?',
    answer: [
      'Payouts clear two days after the trip date, to the bank account or PayPal address on file.',
      'The ledger in your dashboard shows gross, platform fee and net for every booking.',
    ],
  },
  {
    id: 'instant-book',
    category: 'owners',
    question: 'Should I turn on Instant Book?',
    answer: [
      'Instant Book listings convert better because guests do not have to wait for a reply.',
      'It only works if your calendar is accurate — turn it on once you are confident in your availability.',
    ],
  },
  {
    id: 'verification',
    category: 'safety',
    question: 'What does the verification badge mean?',
    answer: [
      'It means the operator has submitted licence and insurance documents that our team has reviewed.',
      'Enhanced check means a broader review including business registration.',
    ],
  },
  {
    id: 'emergency',
    category: 'safety',
    question: 'Something went wrong on the water. What do I do?',
    answer: [
      'Call your local emergency number first.',
      `Then contact us on ${brand.supportPhone} so we can deal with the booking.`,
    ],
  },
];

const CATEGORIES = [
  { key: 'booking', title: 'Booking', icon: 'tag' },
  { key: 'payments', title: 'Payments', icon: 'card' },
  { key: 'cancellations', title: 'Cancellations', icon: 'refresh' },
  { key: 'account', title: 'Account', icon: 'user' },
  { key: 'owners', title: 'For operators', icon: 'boat' },
  { key: 'safety', title: 'Safety', icon: 'shield' },
] as const;

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex items-center gap-1 text-xs text-ink-muted">
          <li><Link href="/" className="hover:underline">{t('navigation', 'home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-ink-soft" aria-current="page">{t('navigation', 'helpCenter')}</li>
        </ol>
      </nav>

      <SectionHeading
        title={t('navigation', 'helpCenter')}
        subtitle={`Answers about booking, paying, cancelling and listing on ${brand.name}.`}
        level={1}
      />

      <HelpSearch articles={helpArticles} categories={CATEGORIES} />

      <section className="mt-10 rounded-card border border-line bg-surface-sunken p-5 text-center">
        <h2 className="text-base font-bold text-ink">{t('navigation', 'getHelp')}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Still stuck? Our support team answers seven days a week.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <a
            href={`tel:${brand.supportPhone.replace(/\s/g, '')}`}
            className="flex h-11 items-center gap-2 rounded-control bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <Icon name="phone" size={16} />
            {brand.supportPhone}
          </a>
          <a
            href={`mailto:${brand.supportEmail}`}
            className="flex h-11 items-center gap-2 rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken"
          >
            <Icon name="mail" size={16} />
            {brand.supportEmail}
          </a>
        </div>
      </section>
    </div>
  );
}
