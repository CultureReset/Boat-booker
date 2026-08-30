import { emptyDatabase, type Database } from '@/lib/domain/types';

/**
 * Storage is defined as an interface first so the platform is not tied to any
 * one backend. The app ships with an in-process adapter that snapshots to
 * JSON on disk; swapping in Postgres, Supabase or a remote API means writing
 * one more class here and changing the factory in ./index.ts. No service or
 * route handler imports a concrete adapter.
 */
export interface StorageAdapter {
  /** Load the database into memory. Called once per process. */
  load(): Promise<Database>;
  /** Persist the current snapshot. Adapters may batch or no-op. */
  persist(db: Database): Promise<void>;
  /** Human-readable name, surfaced on the health endpoint. */
  readonly name: string;
}

/** Non-persistent adapter. Every process starts from the seed. */
export class MemoryAdapter implements StorageAdapter {
  readonly name = 'memory';
  private snapshot: Database;

  constructor(seed?: Database) {
    this.snapshot = seed ?? emptyDatabase();
  }

  async load(): Promise<Database> {
    return this.snapshot;
  }

  async persist(db: Database): Promise<void> {
    this.snapshot = db;
  }
}

/**
 * Writes the whole snapshot to a single JSON file. Adequate for a demo
 * deployment and for local development where restarts should not lose data.
 * Writes are debounced and serialised so concurrent requests cannot interleave
 * a half-written file.
 */
export class JsonFileAdapter implements StorageAdapter {
  readonly name = 'json-file';
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private pending: Database | null = null;

  constructor(
    private readonly filePath: string,
    private readonly seedFactory: () => Database,
    private readonly debounceMs = 250,
  ) {}

  async load(): Promise<Database> {
    const { readFile, mkdir } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<Database>;
      // Merge over an empty database so a snapshot written by an older build
      // that lacks a newer collection still loads.
      return { ...emptyDatabase(), ...parsed } as Database;
    } catch {
      await mkdir(dirname(this.filePath), { recursive: true }).catch(() => {});
      const seeded = this.seedFactory();
      await this.writeNow(seeded);
      return seeded;
    }
  }

  async persist(db: Database): Promise<void> {
    this.pending = db;
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      const snapshot = this.pending;
      this.pending = null;
      if (snapshot) {
        this.writeChain = this.writeChain.then(() => this.writeNow(snapshot)).catch(() => {});
      }
    }, this.debounceMs);
  }

  private async writeNow(db: Database): Promise<void> {
    const { writeFile, rename } = await import('node:fs/promises');
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(db), 'utf8');
    // Rename is atomic on the same filesystem, so a reader never sees a
    // partially written snapshot.
    await rename(tmp, this.filePath);
  }
}
