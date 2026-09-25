import { cacheKeys, getCache, ttls } from "@/lib/cache";

/**
 * A CEO board's sheet read, through the shared cache, that degrades to its last
 * good figures instead of to zeros.
 *
 * The cache already serves a fresh copy, and a stale one while it re-reads in the
 * background. What it can't do is help once an entry has fully expired and the
 * re-read fails — the Sheets read quota, which every CEO board shares, is the usual
 * culprit. So every successful read is also kept under a long-lived `lastGoodKey`;
 * when a read fails, that copy is served with `staleSince` set to when it was
 * taken, and the board says so.
 *
 * A failing sheet read is not retried here: a retry spends more of the same quota
 * that just ran out. If the cache backend itself is down (the sheet was never
 * tried), the sheet is read directly once — the cache is an optimisation and must
 * not be able to take the numbers off the wall.
 */

export interface CachedLoad<T> {
  value: T;
  /** ISO time the served copy was read, when it's a fallback; null when current. */
  staleSince: string | null;
}

interface LastGood<T> {
  value: T;
  savedAt: string;
}

export async function cachedSheetLoad<T>(opts: {
  /** Cache key for the current copy. */
  key: string;
  /** Where the last good copy lives (see `cacheKeys.lastGood`). */
  lastGoodKey: string;
  loader: () => Promise<T>;
  ttlMs: number;
  staleMs: number;
  /** How long the last good copy is kept. */
  lastGoodTtlMs: number;
}): Promise<CachedLoad<T>> {
  const { key, lastGoodKey, loader, ttlMs, staleMs, lastGoodTtlMs } = opts;
  const cache = getCache();
  let sheetFailed = false;

  // Every real read — foreground or background refresh — also refreshes the
  // fallback copy. Best-effort: failing to save it must not fail the read.
  const readAndKeep = async (): Promise<T> => {
    let value: T;
    try {
      value = await loader();
    } catch (err) {
      sheetFailed = true;
      throw err;
    }
    const lastGood: LastGood<T> = { value, savedAt: new Date().toISOString() };
    void cache.set(lastGoodKey, lastGood, { ttlMs: lastGoodTtlMs }).catch((err) => {
      console.error(`[ceo-cache] could not save last-good copy ${lastGoodKey}:`, err);
    });
    return value;
  };

  try {
    return { value: await cache.getOrLoad<T>(key, readAndKeep, { ttlMs, staleMs }), staleSince: null };
  } catch (err) {
    let saved: LastGood<T> | null = null;
    try {
      saved = await cache.get<LastGood<T>>(lastGoodKey);
    } catch {
      // The cache backend is unreachable; there's no saved copy to offer.
    }
    if (saved) {
      console.error(`[ceo-cache] ${key} unreadable, serving the copy saved ${saved.savedAt}:`, err);
      return { value: saved.value, staleSince: saved.savedAt };
    }
    if (sheetFailed) throw err;
    console.error(`[ceo-cache] cache unavailable for ${key}, reading the sheet directly:`, err);
    return { value: await loader(), staleSince: null };
  }
}

/**
 * A deliverable tracker's read (PRs, video interviews, magazine materials, short
 * form videos): cached under `key`, with its last good copy kept as `name`.
 */
export function loadCeoTracker<T>(key: string, name: string, loader: () => Promise<T>): Promise<CachedLoad<T>> {
  return cachedSheetLoad({
    key,
    lastGoodKey: cacheKeys.lastGood(name),
    loader,
    ttlMs: ttls.CEO_TRACKER,
    staleMs: ttls.CEO_TRACKER_STALE,
    lastGoodTtlMs: ttls.CEO_LAST_GOOD,
  });
}
