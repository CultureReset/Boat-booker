/**
 * Single source of truth for platform identity. Every user-facing surface
 * reads from here, so the whole product can be rebranded without touching a
 * component. Values are overridable through environment variables so the same
 * build can serve multiple white-label deployments.
 */
export interface BrandConfig {
  /** Legal/company name used in copyright lines and contracts. */
  legalName: string;
  /** Display name used across the UI. */
  name: string;
  /** Short domain shown in emails and share sheets. */
  domain: string;
  tagline: string;
  supportPhone: string;
  supportEmail: string;
  helpCenterUrl: string;
  blogUrl: string;
  social: { label: string; href: string; icon: SocialIcon }[];
  appStore: { ios: string; android: string };
  /** Public review aggregate rendered in the home-page trust block. */
  reviewAggregate: { score: number; outOf: number; count: number; source: string };
  foundedYear: number;
}

export type SocialIcon = 'facebook' | 'instagram' | 'x' | 'youtube';

const env = (key: string, fallback: string) =>
  (typeof process !== 'undefined' && process.env?.[key]) || fallback;

export const brand: BrandConfig = {
  legalName: env('NEXT_PUBLIC_BRAND_LEGAL_NAME', 'BoatBooker, Inc.'),
  name: env('NEXT_PUBLIC_BRAND_NAME', 'BoatBooker'),
  domain: env('NEXT_PUBLIC_BRAND_DOMAIN', 'boatbooker.com'),
  tagline: 'Boating trips made easy',
  supportPhone: env('NEXT_PUBLIC_SUPPORT_PHONE', '+1 (833) 800-2628'),
  supportEmail: env('NEXT_PUBLIC_SUPPORT_EMAIL', 'support@boatbooker.com'),
  helpCenterUrl: '/help',
  blogUrl: '/blog',
  social: [
    { label: 'Facebook', href: '#', icon: 'facebook' },
    { label: 'Instagram', href: '#', icon: 'instagram' },
    { label: 'X', href: '#', icon: 'x' },
  ],
  appStore: { ios: '#', android: '#' },
  reviewAggregate: { score: 4.9, outOf: 5, count: 114, source: 'Shopper Approved' },
  foundedYear: 2020,
};

/**
 * Commission and fee model. Kept in config because it drives both the
 * customer-facing price breakdown and the owner payout ledger.
 */
export const commerceConfig = {
  /** Share of trip price retained by the platform, applied to owner payouts. */
  serviceFeeRate: 0.15,
  /** Card processing fee applied on top of online payments. */
  cardProcessingRate: 0.03,
  /** Default share of the trip price taken at booking time. */
  defaultDepositRate: 0.2,
  /** Loyalty tiers unlocked by number of completed trips. */
  loyaltyTiers: [
    { level: 1, completedTrips: 1, discountPercentage: 5 },
    { level: 2, completedTrips: 3, discountPercentage: 8 },
    { level: 3, completedTrips: 6, discountPercentage: 10 },
    { level: 4, completedTrips: 10, discountPercentage: 12 },
  ],
  /** Credit granted to both parties when an invite converts. */
  referralCredit: 50,
  /** Hours a captain has to respond before an inquiry auto-expires. */
  inquiryResponseWindowHours: 24,
} as const;
