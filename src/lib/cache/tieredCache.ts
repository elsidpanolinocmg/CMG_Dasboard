import type { Cache, CacheBackend, CacheEntry, CacheLoadOptions } from "./types";

export class TieredCache implements Cache {
  private inflight = new Map<string, Promise<unknown>>();

  constructor(
    private memory: CacheBackend,
    private persistent: CacheBackend,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const mem = await this.memory.get<T>(key);
    if (mem) return mem.value;
    const persisted = await this.persistent.get<T>(key);
    if (!persisted) return null;
    await this.memory.set(key, persisted);
    return persisted.value;
  }

  async set<T>(key: string, value: T, opts: CacheLoadOptions): Promise<void> {
    const entry = this.entryFromValue(value, opts);
    await Promise.all([this.memory.set(key, entry), this.persistent.set(key, entry)]);
  }

  async getOrLoad<T>(
    key: string,
    loader: () => Promise<T>,
    opts: CacheLoadOptions,
  ): Promise<T> {
    const now = Date.now();

    const mem = await this.memory.get<T>(key);
    if (mem && now < mem.staleAt) return mem.value;

    if (!mem) {
      const persisted = await this.persistent.get<T>(key);
      if (persisted) {
        await this.memory.set(key, persisted);
        if (now < persisted.staleAt) return persisted.value;
        if (now < persisted.expiresAt) {
          this.refreshInBackground(key, loader, opts);
          return persisted.value;
        }
      }
    } else if (now < mem.expiresAt) {
      this.refreshInBackground(key, loader, opts);
      return mem.value;
    }

    return this.loadAndStore(key, loader, opts);
  }

  async invalidate(
    keyOrPrefix: string,
    opts?: { prefix?: boolean },
  ): Promise<number> {
    if (opts?.prefix) {
      const [m, p] = await Promise.all([
        this.memory.deletePrefix(keyOrPrefix),
        this.persistent.deletePrefix(keyOrPrefix),
      ]);
      return Math.max(m, p);
    }
    await Promise.all([
      this.memory.delete(keyOrPrefix),
      this.persistent.delete(keyOrPrefix),
    ]);
    return 1;
  }

  private entryFromValue<T>(value: T, opts: CacheLoadOptions): CacheEntry<T> {
    const now = Date.now();
    const expiresAt = now + opts.ttlMs;
    const staleAt = now + (opts.staleMs ?? opts.ttlMs);
    return { value, expiresAt, staleAt };
  }

  private async loadAndStore<T>(
    key: string,
    loader: () => Promise<T>,
    opts: CacheLoadOptions,
  ): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = (async () => {
      const value = await loader();
      const entry = this.entryFromValue(value, opts);
      await Promise.all([
        this.memory.set(key, entry),
        this.persistent.set(key, entry),
      ]);
      return value;
    })().finally(() => this.inflight.delete(key));

    this.inflight.set(key, promise);
    return promise;
  }

  private refreshInBackground<T>(
    key: string,
    loader: () => Promise<T>,
    opts: CacheLoadOptions,
  ): void {
    if (this.inflight.has(key)) return;
    void this.loadAndStore(key, loader, opts).catch((err) => {
      console.error(`[cache] background refresh failed for ${key}:`, err);
    });
  }
}
