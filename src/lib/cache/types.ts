export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  staleAt: number;
}

export interface CacheBackend {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
}

export interface CacheLoadOptions {
  ttlMs: number;
  staleMs?: number;
}

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, opts: CacheLoadOptions): Promise<void>;
  getOrLoad<T>(
    key: string,
    loader: () => Promise<T>,
    opts: CacheLoadOptions,
  ): Promise<T>;
  invalidate(keyOrPrefix: string, opts?: { prefix?: boolean }): Promise<number>;
}
