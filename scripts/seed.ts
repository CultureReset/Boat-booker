/**
 * Regenerates the seed snapshot on disk.
 *
 * The generator is deterministic, so running this reproduces exactly the same
 * dataset — useful for resetting a demo after it has been poked at, without
 * changing any IDs that might be bookmarked.
 *
 *   npm run seed            # rewrite .data/boatbooker.json
 *   npm run seed -- --stats # rewrite and print what was generated
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { buildSeed } from '../src/lib/seed/build';

async function main(): Promise<void> {
  const target = process.env.STORAGE_FILE ?? join(process.cwd(), '.data', 'boatbooker.json');

  console.log('Generating seed…');
  const started = Date.now();
  const db = buildSeed();
  const elapsed = Date.now() - started;

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(db), 'utf8');

  console.log(`Wrote ${target} in ${elapsed}ms`);

  if (process.argv.includes('--stats')) {
    const rows: [string, number][] = [
      ['users', db.users.length],
      ['  owners', db.users.filter((u) => u.role === 'owner').length],
      ['  customers', db.users.filter((u) => u.role === 'customer').length],
      ['destinations', db.destinations.length],
      ['charters', db.charters.length],
      ['packages', db.packages.length],
      ['bookings', db.bookings.length],
      ['  confirmed', db.bookings.filter((b) => b.status === 'confirmed').length],
      ['  pending', db.bookings.filter((b) => b.status === 'pending').length],
      ['  done', db.bookings.filter((b) => b.status === 'done').length],
      ['reviews', db.reviews.length],
      ['threads', db.threads.length],
      ['messages', db.messages.length],
      ['payouts', db.payouts.length],
      ['availability blocks', db.availability.length],
      ['offers', db.offers.length],
      ['add-ons', db.addOns.length],
      ['itineraries', db.itineraries.length],
      ['  published', db.itineraries.filter((i) => i.status === 'published').length],
      ['quick replies', db.quickReplies.length],
      ['account health', db.accountHealth.length],
      ['direct settings', db.directSettings.length],
      ['  enabled', db.directSettings.filter((d) => d.enabled).length],
      ['catches', db.catches.length],
    ];

    console.log('');
    for (const [label, count] of rows) {
      console.log(`  ${label.padEnd(22)} ${String(count).padStart(6)}`);
    }
    console.log('\nDemo accounts (password: Password123)');
    console.log('  guest@boatbooker.demo   customer');
    console.log('  owner@boatbooker.demo   owner');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
