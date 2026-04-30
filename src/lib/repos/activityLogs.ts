import { getDb } from "@/lib/db";
import type { ActivityLog } from "@/lib/entities";

const COLLECTION = "activity_logs";

async function col() {
  const db = await getDb();
  return db.collection<ActivityLog>(COLLECTION);
}

export async function record(entry: Omit<ActivityLog, "_id">): Promise<void> {
  await (await col()).insertOne(entry);
}

export interface ListFilter {
  actorUsername?: string;
  action?: string;
  actionPrefix?: string;
  targetType?: string;
  targetId?: string;
  since?: Date;
}

export async function list(
  filter: ListFilter = {},
  opts: { limit?: number; skip?: number } = {},
): Promise<ActivityLog[]> {
  const q: Record<string, unknown> = {};
  if (filter.actorUsername) q.actorUsername = filter.actorUsername;
  if (filter.action) q.action = filter.action;
  if (filter.actionPrefix) q.action = { $regex: `^${filter.actionPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` };
  if (filter.targetType) q.targetType = filter.targetType;
  if (filter.targetId) q.targetId = filter.targetId;
  if (filter.since) q.at = { $gte: filter.since };
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const skip = Math.max(opts.skip ?? 0, 0);
  return (await col()).find(q).sort({ at: -1 }).skip(skip).limit(limit).toArray();
}

export async function distinctActors(): Promise<string[]> {
  return (await col()).distinct("actorUsername");
}

export async function distinctActions(): Promise<string[]> {
  return (await col()).distinct("action");
}
