import * as activityLogs from "@/lib/repos/activityLogs";
import LogsClient from "./LogsClient";
import Hint from "../_widgets/Hint";

export const dynamic = "force-dynamic";

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; action?: string; limit?: string }>;
}) {
  const params = await searchParams;
  const actor = params.actor?.trim() || undefined;
  const action = params.action?.trim() || undefined;
  const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 500);

  const [items, actors, actions] = await Promise.all([
    activityLogs.list(
      { actorUsername: actor, actionPrefix: action },
      { limit },
    ),
    activityLogs.distinctActors(),
    activityLogs.distinctActions(),
  ]);

  const safe = items.map((l) => ({
    id: l._id?.toString() ?? "",
    at: l.at instanceof Date ? l.at.toISOString() : new Date(l.at as unknown as string).toISOString(),
    actorUsername: l.actorUsername,
    action: l.action,
    targetType: l.targetType ?? "",
    targetId: l.targetId ?? "",
    before: l.before,
    after: l.after,
    metadata: l.metadata,
    ip: l.ip ?? "",
    userAgent: l.userAgent ?? "",
  }));

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h1 className="font-semibold">
          Activity logs
          <Hint>
            Admin actions are recorded here. Click a row to see before/after values.
          </Hint>
        </h1>
      </div>
      <LogsClient
        items={safe}
        actors={actors.sort()}
        actions={actions.sort()}
        currentActor={actor ?? ""}
        currentAction={action ?? ""}
        currentLimit={limit}
      />
    </div>
  );
}
