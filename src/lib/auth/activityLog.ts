import type { NextRequest } from "next/server";
import * as activityLogs from "@/lib/repos/activityLogs";
import { getAdminSession } from "@/lib/auth/adminAuth";

export interface LogActivityArgs {
  action: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

function getIp(req: NextRequest | Request): string | undefined {
  const fwd =
    req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");
  if (!fwd) return undefined;
  return fwd.split(",")[0]?.trim() || undefined;
}

export async function logActivity(
  req: NextRequest | Request,
  args: LogActivityArgs,
): Promise<void> {
  try {
    const session = await getAdminSession(req);
    const actor = session?.username ?? "anonymous";
    await activityLogs.record({
      at: new Date(),
      actorUsername: actor,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      before: args.before,
      after: args.after,
      metadata: args.metadata,
      ip: getIp(req),
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
  } catch (err) {
    // Best-effort: never let logging break the actual request.
    console.error("activityLog: failed to record", err);
  }
}
