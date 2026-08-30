/**
 * Identifier helpers.
 *
 * Seed data needs to be reproducible across restarts (so bookmarked listing
 * URLs keep working), which rules out random IDs in the generator. Runtime
 * records use `randomUUID`; seeded records use a deterministic counter driven
 * by `mulberry32` below.
 */

/** Small, fast, seedable PRNG. Same seed always yields the same sequence. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  (): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Pick `count` distinct items, or as many as exist. */
  sample<T>(items: readonly T[], count: number): T[];
  bool(probability?: number): boolean;
  /** Weighted choice: `[[value, weight], …]`. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const rng = (() => next()) as Rng;

  rng.int = (min, max) => Math.floor(next() * (max - min + 1)) + min;
  rng.pick = (items) => items[Math.floor(next() * items.length)];
  rng.bool = (probability = 0.5) => next() < probability;
  rng.sample = (items, count) => {
    const pool = [...items];
    const out: typeof pool = [];
    const take = Math.min(count, pool.length);
    for (let i = 0; i < take; i += 1) {
      out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
    }
    return out;
  };
  rng.weighted = (entries) => {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = next() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return entries[entries.length - 1][0];
  };

  return rng;
}

/** Runtime unique ID. Falls back to a counter where crypto is unavailable. */
let counter = 0;
export function newId(prefix = ''): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}${(counter += 1).toString(36)}`;
  return prefix ? `${prefix}_${random}` : random;
}

/** Human-facing booking reference, e.g. `BB-7K4Q2M`. */
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newBookingReference(rand: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += REFERENCE_ALPHABET[Math.floor(rand() * REFERENCE_ALPHABET.length)];
  }
  return `BB-${out}`;
}

/** URL-safe slug used for destinations, activities and listing URLs. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
