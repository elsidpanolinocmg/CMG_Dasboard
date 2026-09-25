"use client";

import { cachePrefixes } from "@/lib/cache/keys";
import { BoardCard, backlogSeverity, buildStatusColors, CardBoard, type CardState } from "./CeoCardBoard";
import type { CampaignDeliverables } from "@/lib/ceo-deliverables/deliverables";

/** "Done" (published) is the only finished state on this board. */
const DONE_COLORS: Record<string, string> = { done: "#0ca30c" };

/** One campaign as a card: its % published, status mix, what's left and the deadline. */
function DeliverableCard({
  c,
  state,
  verb,
  colors,
  onOpen,
}: {
  c: CampaignDeliverables;
  state: CardState;
  verb: string;
  colors: Map<string, string>;
  onOpen?: () => void;
}) {
  const severity = backlogSeverity(c.done, c.total, c.outstanding);
  return (
    <BoardCard
      name={c.campaign}
      pct={c.total ? Math.round((c.done / c.total) * 100) : 0}
      statuses={c.statuses}
      total={c.total}
      colors={colors}
      state={state}
      flag={state === "overdue" ? { severity, title: `${c.outstanding} outstanding — ${severity} backlog` } : null}
      countLabel={state === "ontrack" && c.outstanding === 0 ? "Completed" : `${c.outstanding} ${verb}`}
      dueLabel={c.dueLabel}
      dueSoon={state === "ontrack" && c.dueSoon}
      onOpen={onOpen}
    />
  );
}

export interface DeliverablesBodyProps {
  overdue: CampaignDeliverables[];
  onTrack: CampaignDeliverables[];
  statusLegend: string[];
}

/** The PRs & Interviews board: past-deadline campaigns beside the ones still ahead. */
export function DeliverablesBody({ overdue, onTrack, statusLegend }: DeliverablesBodyProps) {
  const colors = buildStatusColors(statusLegend, DONE_COLORS);
  return (
    <CardBoard
      statusLegend={statusLegend}
      colors={colors}
      refreshCache={[cachePrefixes.ceoDeliverables]}
      details={(c) => ({
        title: c.campaign,
        summary:
          `${c.outstanding} of ${c.total} not yet published` +
          (c.deadline ? ` · deadline ${c.deadline}${c.dueLabel ? ` (${c.dueLabel})` : ""}` : ""),
        items: c.items,
        doneLabel: "published",
      })}
      columns={[
        {
          label: "Overdue · past deadline",
          state: "overdue",
          rows: overdue,
          empty: "Nothing overdue — every past-deadline deliverable is done.",
          getKey: (c) => c.campaign,
          renderCard: (c, open) => <DeliverableCard c={c} state="overdue" verb="pending" colors={colors} onOpen={open} />,
        },
        {
          label: "On track · deadline ahead",
          state: "ontrack",
          rows: onTrack,
          empty: "No upcoming campaigns with work outstanding.",
          getKey: (c) => c.campaign,
          renderCard: (c, open) => (
            <DeliverableCard c={c} state="ontrack" verb="in progress" colors={colors} onOpen={open} />
          ),
        },
      ]}
    />
  );
}
