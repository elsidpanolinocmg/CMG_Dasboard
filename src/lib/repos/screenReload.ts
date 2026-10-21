import { getDb } from "@/lib/db";

const COLLECTION = "screen_signals";
const RELOAD_ID = "reload";

/**
 * "full" reloads the page (needed to pick up a new deploy, but the browser
 * drops fullscreen). "soft" refreshes the page's data and rebuilds it in
 * place, so a fullscreen screen stays fullscreen.
 */
export type ReloadKind = "full" | "soft";

interface ScreenSignal {
  id: string;
  /** Last full reload request. */
  at?: Date;
  /** Last soft refresh request. */
  softAt?: Date;
}

export interface ReloadSignal {
  /** ms since epoch; 0 when never requested. */
  at: number;
  softAt: number;
}

async function col() {
  const db = await getDb();
  return db.collection<ScreenSignal>(COLLECTION);
}

/** When an admin last asked every open screen to reload or refresh. */
export async function getReloadSignal(): Promise<ReloadSignal> {
  const doc = await (await col()).findOne({ id: RELOAD_ID });
  return { at: doc?.at?.getTime() ?? 0, softAt: doc?.softAt?.getTime() ?? 0 };
}

export async function requestReload(kind: ReloadKind, now: Date = new Date()): Promise<number> {
  await (await col()).updateOne(
    { id: RELOAD_ID },
    { $set: { id: RELOAD_ID, [kind === "full" ? "at" : "softAt"]: now } },
    { upsert: true },
  );
  return now.getTime();
}
