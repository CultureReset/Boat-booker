/**
 * Mobile screenshot tour.
 *
 * Walks every screen at a Pixel-7 viewport with an Android user agent, signed
 * in as each demo account, and writes one screenshot per screen alongside any
 * bad HTTP status or console error.
 *
 * This exists because the bugs that matter on a phone do not fail a build. A
 * dashboard collapsing to one column, a composer floating above a gutter, a
 * payout table that only scrolls sideways, a `%date%` rendered raw, two copies
 * of a heading — every one of those passed `typecheck`, `check:i18n` and
 * `build`, and was found by looking at the output of this script.
 *
 *   npm start                 # in one shell, with SESSION_SECRET set
 *   npm run tour              # in another
 *   # then open .tour/*.png
 *
 * `playwright-core` and a Chromium build are not dependencies — CI does not
 * need them and they are large. Install them when you want to run this:
 *
 *   npm install --no-save playwright-core
 *
 * The browser is found at PLAYWRIGHT_BROWSERS_PATH or CHROMIUM_PATH.
 */

const { existsSync, mkdirSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const BASE = process.env.TOUR_BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.TOUR_OUT ?? '.tour';

/** Pixel 7: the device class the Play Store screenshots were captured on. */
const PHONE = { width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

const GUEST = ['guest@boatbooker.demo', 'Password123'];
const OWNER = ['owner@boatbooker.demo', 'Password123'];

/** Screens reachable without following a link. Dynamic ones are found below. */
const PUBLIC = [
  ['01-home', '/'],
  ['02-search', '/charters/search'],
  ['04-catches', '/catches'],
  ['05-login', '/login'],
  ['06-destinations', '/locations'],
  ['07-activity', '/activity'],
  ['08-help', '/help'],
  ['09-deals', '/deals'],
  ['09b-deals-campaign', '/deals/boaters-choice'],
];

const GUEST_SCREENS = [
  ['10-bookings', '/account/bookings'],
  ['14-inbox', '/account/inbox'],
  ['16-wishlist', '/account/wishlist'],
  ['17-menu', '/account/menu'],
  ['18-profile', '/account/profile'],
  ['19-loyalty', '/account/loyalty'],
  ['20-referrals', '/account/referrals'],
  ['21-payment-methods', '/account/payment-methods'],
  ['22-notifications', '/account/notifications'],
  ['23-settings', '/account/settings'],
  ['24-reviews', '/account/reviews'],
  ['25-memories', '/trip-memories'],
  ['27-shared-wishlist', '/shared-wishlist'],
  ['28-finish-registration', '/finish-registration'],
];

const OWNER_SCREENS = [
  ['30-owner-home', '/owner'],
  ['31-owner-calendar', '/owner/calendar'],
  ['32-owner-bookings', '/owner/bookings'],
  ['34-owner-inbox', '/owner/inbox'],
  ['36-owner-menu', '/owner/menu'],
  ['37-owner-listings', '/owner/listings'],
  ['41-owner-performance', '/owner/performance'],
  ['42-owner-opportunities', '/owner/opportunities'],
  ['43-owner-payouts', '/owner/payouts'],
  ['44-owner-payout-methods', '/owner/payout-methods'],
  ['45-owner-reviews', '/owner/reviews'],
  ['46-owner-direct', '/owner/direct'],
  ['47-owner-quick-replies', '/owner/quick-replies'],
  ['48-owner-calendar-links', '/owner/calendar/links'],
  ['49-owner-team', '/owner/team'],
  ['50-owner-verification', '/owner/verification'],
  ['51-owner-widgets', '/owner/widgets'],
  ['52-owner-settings', '/owner/settings'],
];

function loadPlaywright() {
  try {
    return require('playwright-core');
  } catch {
    return null;
  }
}

/** Chromium is wherever the environment put it; guessing one path is fragile. */
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;

  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return null;

  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium')) continue;
    for (const candidate of [
      join(root, entry, 'chrome-linux', 'chrome'),
      join(root, entry, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
    ]) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

async function main() {
  const playwright = loadPlaywright();
  if (!playwright) {
    console.log('playwright-core is not installed — skipping the tour.');
    console.log('  npm install --no-save playwright-core');
    return;
  }

  const executablePath = findChromium();
  if (!executablePath) {
    console.log('No Chromium found. Set CHROMIUM_PATH or PLAYWRIGHT_BROWSERS_PATH.');
    return;
  }

  mkdirSync(OUT, { recursive: true });

  const browser = await playwright.chromium.launch({ executablePath });
  const errors = [];
  const bad = [];
  let shot = 0;

  const open = async (who) => {
    const ctx = await browser.newContext({ viewport: PHONE, userAgent: UA });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${who}] ${page.url()} :: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`[${who}] ${page.url()} :: ${e.message}`));
    return { ctx, page };
  };

  const shoot = async (page, name, path) => {
    const response = await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch((error) => {
      bad.push(`${path} :: ${error.message}`);
      return null;
    });
    if (response && response.status() >= 400) bad.push(`${path} :: HTTP ${response.status()}`);

    // Settle animations and any client fetch the screen fires on mount.
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `${name}.png`) });
    shot += 1;
  };

  const hrefOf = async (page, selector) => {
    const el = await page.$(selector);
    return el ? el.getAttribute('href') : null;
  };

  const login = async (page, [email, password]) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type=email]', email);
    // The email step comes first; the password field appears after it.
    if (!(await page.$('input[type=password]'))) {
      await page.click('button[type=submit]');
      await page.waitForTimeout(600);
    }
    await page.fill('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForTimeout(1500);
  };

  // ---- public --------------------------------------------------------------
  let { ctx, page } = await open('public');
  for (const [name, path] of PUBLIC) await shoot(page, name, path);

  const listing = await hrefOf(page, 'a[href^="/charters/view/"]');
  if (listing) await shoot(page, '03-listing', listing);
  await ctx.close();

  // ---- guest ---------------------------------------------------------------
  ({ ctx, page } = await open('guest'));
  await login(page, GUEST);
  for (const [name, path] of GUEST_SCREENS) await shoot(page, name, path);

  // Screens that only exist for a record: reached the way a person would.
  const booking = await hrefOf(page, 'a[href^="/account/bookings/"]');
  if (booking) {
    await shoot(page, '11-booking-detail', booking);
    await shoot(page, '12-booking-change', `${booking}/change`);
    await shoot(page, '13-booking-cancel', `${booking}/cancel`);
  }

  await page.goto(`${BASE}/account/inbox`, { waitUntil: 'networkidle' });
  const thread = await hrefOf(page, 'a[href^="/account/inbox/"]');
  if (thread) await shoot(page, '15-thread', thread);

  await page.goto(`${BASE}/trip-memories`, { waitUntil: 'networkidle' });
  const memory = await hrefOf(page, 'a[href^="/trip-memory/"]');
  if (memory) await shoot(page, '26-memory', memory);
  await ctx.close();

  // ---- owner ---------------------------------------------------------------
  ({ ctx, page } = await open('owner'));
  await login(page, OWNER);
  for (const [name, path] of OWNER_SCREENS) await shoot(page, name, path);

  await page.goto(`${BASE}/owner/bookings`, { waitUntil: 'networkidle' });
  const ownerBooking = await hrefOf(page, 'a[href^="/owner/bookings/"]');
  if (ownerBooking) await shoot(page, '33-owner-booking-detail', ownerBooking);

  await page.goto(`${BASE}/owner/inbox`, { waitUntil: 'networkidle' });
  const ownerThread = await hrefOf(page, 'a[href^="/owner/inbox/"]');
  if (ownerThread) await shoot(page, '35-owner-thread', ownerThread);

  await page.goto(`${BASE}/owner/listings`, { waitUntil: 'networkidle' });
  const ownerListing = await hrefOf(page, 'a[href^="/owner/listings/"]');
  if (ownerListing) {
    await shoot(page, '38-owner-listing-edit', ownerListing);
    await shoot(page, '39-owner-itineraries', `${ownerListing}/itineraries`);
    await shoot(page, '40-owner-add-ons', `${ownerListing}/add-ons`);
  }
  await ctx.close();

  await browser.close();

  console.log(`\n${shot} screens written to ${OUT}/`);
  console.log(bad.length ? `\nBAD RESPONSES (${bad.length}):\n  ${bad.join('\n  ')}` : '\nAll routes returned OK.');
  console.log(
    errors.length ? `\nCONSOLE ERRORS (${errors.length}):\n  ${errors.join('\n  ')}` : 'No console errors.',
  );
  console.log('\nNow look at the screenshots. That is the point of this script.');

  if (bad.length || errors.length) process.exit(1);
}

main().catch((error) => {
  console.error('\nTour crashed:', error);
  process.exit(1);
});
