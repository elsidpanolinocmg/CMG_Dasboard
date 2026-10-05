import { getDb } from "@/lib/db";

const COLLECTION = "screen_signals";
const RELOAD_ID = "reload";

interface ScreenSignal {
  id: string;
  at: Date;
}

async function col() {
  const db = await getDb();
  return db.collection<ScreenSignal>(COLLECTION);
}

/** When an admin last asked every open screen to reload; 0 when never. */
export async function getReloadAt(): Promise<number> {
  const doc = await (await col()).findOne({ id: RELOAD_ID });
  return doc ? doc.at.getTime() : 0;
}

export async function requestReload(now: Date = new Date()): Promise<number> {
  await (await col()).updateOne(
    { id: RELOAD_ID },
    { $set: { id: RELOAD_ID, at: now } },
    { upsert: true },
  );
  return now.getTime();
}
