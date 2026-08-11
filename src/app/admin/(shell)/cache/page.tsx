import { getDb } from "@/lib/db";
import { cachePrefixes } from "@/lib/cache";
import CacheActions from "./CacheActions";
import Hint from "../_widgets/Hint";

export const dynamic = "force-dynamic";

interface CacheRow {
  key: string;
  expiresAt: Date;
  staleAt: Date;
  createdAt: Date;
}

const ROW_LIMIT = 200;

async function loadCacheRows(): Promise<{ rows: CacheRow[]; total: number }> {
  const db = await getDb();
  const col = db.collection<CacheRow>("cache_entries");
  const [rows, total] = await Promise.all([
    col
      .find({}, { projection: { _id: 0, key: 1, expiresAt: 1, staleAt: 1, createdAt: 1 } })
      .sort({ key: 1 })
      .limit(ROW_LIMIT)
      .toArray(),
    col.countDocuments({}),
  ]);
  return { rows, total };
}

export default async function CachePage() {
  const { rows, total } = await loadCacheRows();
  const now = Date.now();
  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <div>
        <h1 className="font-semibold">
          Cache
          <Hint>
            Persistent layer of the tiered cache. Memory layer hydrates from
            this on cold start.
          </Hint>
        </h1>
      </div>

      <CacheActions prefixes={Object.values(cachePrefixes)} />

      <p className="text-xs opacity-60 -mb-4">
        {total > rows.length
          ? `Showing the first ${rows.length} of ${total} entries, by key.`
          : `${total} ${total === 1 ? "entry" : "entries"}.`}
      </p>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Key</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">Stale at</th>
              <th className="px-3 py-2 font-medium">Expires at</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center opacity-60">
                  Cache is empty.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const expired = now >= new Date(r.expiresAt).getTime();
              const stale = !expired && now >= new Date(r.staleAt).getTime();
              const state = expired ? "expired" : stale ? "stale" : "fresh";
              const color =
                state === "fresh"
                  ? "text-emerald-500"
                  : state === "stale"
                  ? "text-amber-500"
                  : "text-red-500";
              return (
                <tr
                  key={r.key}
                  className="border-t border-black/10 dark:border-white/10"
                >
                  <td className="px-3 py-2 font-mono text-xs">{r.key}</td>
                  <td className={`px-3 py-2 text-xs font-medium ${color}`}>{state}</td>
                  <td className="px-3 py-2 text-xs opacity-70">
                    {new Date(r.staleAt).toISOString()}
                  </td>
                  <td className="px-3 py-2 text-xs opacity-70">
                    {new Date(r.expiresAt).toISOString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
