import { getDb } from "@/lib/db";
import { MemoryCacheBackend } from "./memoryBackend";
import { MongoCacheBackend } from "./mongoBackend";
import { TieredCache } from "./tieredCache";
import type { Cache } from "./types";

declare global {
  var _cmgCache: Cache | undefined;
}

export function getCache(): Cache {
  if (globalThis._cmgCache) return globalThis._cmgCache;
  const cache = new TieredCache(
    new MemoryCacheBackend(),
    new MongoCacheBackend(() => getDb()),
  );
  globalThis._cmgCache = cache;
  return cache;
}

export { cacheKeys, cachePrefixes } from "./keys";
export { ttls } from "./ttls";
export type { Cache, CacheEntry, CacheBackend, CacheLoadOptions } from "./types";
