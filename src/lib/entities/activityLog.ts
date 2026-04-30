import type { ObjectId } from "mongodb";

export interface ActivityLog {
  _id?: ObjectId;
  at: Date;
  actorUsername: string;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}
