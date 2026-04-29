import type { Db } from "mongodb";
import type { CacheBackend, CacheEntry } from "./types";
import type { CacheEntryDoc } from "@/lib/entities/cacheEntry";

const COLLECTION = "cache_entries";

export class MongoCacheBackend implements CacheBackend {
  constructor(private getDb: () => Promise<Db>) {}

  private async col() {
    const db = await this.getDb();
    return db.collection<CacheEntryDoc>(COLLECTION);
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const col = await this.col();
    const doc = await col.findOne({ _id: key });
    if (!doc) return null;
    const expiresAt = doc.expiresAt.getTime();
    if (Date.now() >= expiresAt) return null;
    return {
      value: doc.value as T,
      expiresAt,
      staleAt: doc.staleAt.getTime(),
    };
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const col = await this.col();
    await col.updateOne(
      { _id: key },
      {
        $set: {
          key,
          value: entry.value,
          expiresAt: new Date(entry.expiresAt),
          staleAt: new Date(entry.staleAt),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }

  async delete(key: string): Promise<void> {
    const col = await this.col();
    await col.deleteOne({ _id: key });
  }

  async deletePrefix(prefix: string): Promise<number> {
    const col = await this.col();
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const res = await col.deleteMany({ key: { $regex: `^${escaped}` } });
    return res.deletedCount ?? 0;
  }
}
