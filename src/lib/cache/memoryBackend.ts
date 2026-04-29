import type { CacheBackend, CacheEntry } from "./types";

export class MemoryCacheBackend implements CacheBackend {
  private store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry as CacheEntry<T>;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.store.set(key, entry as CacheEntry<unknown>);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async deletePrefix(prefix: string): Promise<number> {
    let n = 0;
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
        n++;
      }
    }
    return n;
  }

  size(): number {
    return this.store.size;
  }
}
