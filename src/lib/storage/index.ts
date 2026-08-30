import path from 'node:path';
import type { Database } from '@/lib/domain/types';
import { buildSeed } from '@/lib/seed/build';
import { JsonFileAdapter, MemoryAdapter, type StorageAdapter } from './adapter';

/**
 * Process-wide database handle.
 *
 * Next.js recreates module scope on hot reload, so the handle is parked on
 * `globalThis` to keep a single instance across reloads in development.
 */

type Handle = {
  adapter: StorageAdapter;
  db: Database | null;
  loading: Promise<Database> | null;
};

declare global {

  var __boatbookerStore: Handle | undefined;
}

function createAdapter(): StorageAdapter {
  const driver = process.env.STORAGE_DRIVER ?? 'json-file';

  if (driver === 'memory') return new MemoryAdapter(buildSeed());

  const file =
    process.env.STORAGE_FILE ?? path.join(process.cwd(), '.data', 'boatbooker.json');
  return new JsonFileAdapter(file, buildSeed);
}

function handle(): Handle {
  globalThis.__boatbookerStore ??= { adapter: createAdapter(), db: null, loading: null };
  return globalThis.__boatbookerStore;
}

/** Resolve the in-memory database, loading it on first use. */
export async function getDb(): Promise<Database> {
  const h = handle();
  if (h.db) return h.db;
  h.loading ??= h.adapter.load().then((db) => {
    h.db = db;
    h.loading = null;
    return db;
  });
  return h.loading;
}

/**
 * Run a mutation against the database and schedule a snapshot.
 *
 * Mutations are applied synchronously inside the callback so two concurrent
 * requests can never observe a torn intermediate state within a single tick.
 */
export async function mutate<T>(fn: (db: Database) => T): Promise<T> {
  const h = handle();
  const db = await getDb();
  const result = fn(db);
  await h.adapter.persist(db);
  return result;
}

export function adapterName(): string {
  return handle().adapter.name;
}

/** Test hook: replace the database wholesale. */
export async function resetDb(next?: Database): Promise<Database> {
  const h = handle();
  h.db = next ?? buildSeed();
  await h.adapter.persist(h.db);
  return h.db;
}
