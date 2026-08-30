/**
 * Verifies every `t('domain', 'key')` call site resolves to a real catalog
 * entry, and reports catalog entries nothing references.
 *
 * A missing key does not crash — `translate()` returns `domain.key` so a page
 * still renders — which means the only way to catch one is to look. This
 * script is that look, and it runs in CI.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { catalog } from '../src/i18n/catalog';

const SRC = join(process.cwd(), 'src');

/** Matches t('domain', 'key') and translate('domain', 'key'). */
const CALL = /\bt(?:ranslate)?\(\s*'([a-zA-Z]+)'\s*,\s*'([a-zA-Z0-9_]+)'/g;

/** Keys built at runtime rather than written literally. */
const DYNAMIC_ALLOWLIST = new Set([
  // Password rule keys come from `passwordRules` in lib/auth/password.
  'login.passwordMinLength',
  'login.passwordContainsLowercase',
  'login.passwordContainsUppercase',
  'login.passwordContainsNumber',
  // Booking status labels are assembled from the status string.
  'bookings.statusPending',
  'bookings.statusConfirmed',
  'bookings.statusCompleted',
  'bookings.statusCancelled',
  'bookings.statusDeclined',
  'bookings.statusExpired',
  // Owner greeting varies by time of day.
  'owner.goodMorning',
  'owner.goodAfternoon',
  'owner.goodEvening',
  // Home "how it works" steps are indexed 1..3.
  'homepage.howItWorksStep1Title',
  'homepage.howItWorksStep1Body',
  'homepage.howItWorksStep2Title',
  'homepage.howItWorksStep2Body',
  'homepage.howItWorksStep3Title',
  'homepage.howItWorksStep3Body',
  // Star rating words are selected by score.
  'reviews.ratingPoor',
  'reviews.ratingFair',
  'reviews.ratingGood',
  'reviews.ratingVeryGood',
  'reviews.ratingExcellent',
  // Calendar weekday headers are iterated.
  'calendar.weekdayMon',
  'calendar.weekdayTue',
  'calendar.weekdayWed',
  'calendar.weekdayThu',
  'calendar.weekdayFri',
  'calendar.weekdaySat',
  'calendar.weekdaySun',
  // Sort options are iterated from a list.
  'search.sortRecommended',
  'search.sortPriceAsc',
  'search.sortPriceDesc',
  'search.sortRating',
  'search.sortDistance',
  'search.sortNewest',
  // Booking list tabs are iterated.
  'bookings.upcoming',
  'bookings.pending',
  'bookings.completed',
  'bookings.cancelled',
  'bookings.all',
  // Listing editor steps are iterated.
  'owner.stepBasics',
  'owner.stepBoat',
  'owner.stepAmenities',
  'owner.stepPhotos',
  'owner.stepTrips',
  'owner.stepLocation',
  'owner.stepPolicies',
  // Package duration switches between hours and days.
  'packageCard.duration',
  'packageCard.durationDays',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const used = new Set<string>();
const missing: { file: string; domain: string; key: string }[] = [];

for (const file of files) {
  // The catalog and the translator itself are not call sites.
  if (file.includes('i18n/catalog') || file.includes('i18n/translate')) continue;

  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(CALL)) {
    const [, domain, key] = match;
    used.add(`${domain}.${key}`);

    const bundle = (catalog as Record<string, Record<string, string>>)[domain];
    if (!bundle) {
      missing.push({ file, domain, key });
      continue;
    }
    if (typeof bundle[key] !== 'string') missing.push({ file, domain, key });
  }
}

const unused: string[] = [];
for (const [domain, bundle] of Object.entries(catalog)) {
  for (const key of Object.keys(bundle)) {
    const id = `${domain}.${key}`;
    if (!used.has(id) && !DYNAMIC_ALLOWLIST.has(id)) unused.push(id);
  }
}

console.log(`Scanned ${files.length} files.`);
console.log(`${used.size} distinct keys referenced.`);

if (missing.length) {
  console.error(`\n${missing.length} MISSING key(s):`);
  for (const entry of missing) {
    console.error(`  ${entry.domain}.${entry.key}  ←  ${entry.file.replace(process.cwd() + '/', '')}`);
  }
}

if (unused.length) {
  console.log(`\n${unused.length} unreferenced catalog entries (not an error):`);
  console.log('  ' + unused.join(', '));
}

if (missing.length) process.exit(1);
console.log('\nNo missing keys.');
