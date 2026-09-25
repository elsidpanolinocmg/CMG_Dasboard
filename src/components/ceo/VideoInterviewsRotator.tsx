"use client";

import { cachePrefixes } from "@/lib/cache/keys";
import { BoardCard, backlogSeverity, buildStatusColors, CardBoard, type CardState } from "./CeoCardBoard";
import type { AwardInterviews } from "@/lib/ceo-video-interviews/interviews";

/** The finished production states: Published the deeper green, Approved the lighter. */
const DONE_COLORS: Record<string, string> = { published: "#0ca30c", approved: "#34c759" };

/** One award as a card: its % of first drafts sent, status mix, what's pending and the deadline. */
function AwardCard({
  a,
  state,
  colors,
  onOpen,
}: {
  a: AwardInterviews;
  state: CardState;
  colors: Map<string, string>;
  onOpen?: () => void;
}) {
  const severity = backlogSeverity(a.draftsSent, a.total, a.overdueCount);
  const countLabel =
    state === "overdue" ? `${a.overdueCount} overdue` : a.pending === 0 ? "All sent" : `${a.pending} pending`;
  return (
    <BoardCard
      name={a.award}
      pct={a.total ? Math.round((a.draftsSent / a.total) * 100) : 0}
      statuses={a.statuses}
      total={a.total}
      colors={colors}
      state={state}
      flag={
        state === "overdue"
          ? {
              severity,
              title: `${a.overdueCount} draft${a.overdueCount === 1 ? "" : "s"} overdue — ${severity} backlog`,
            }
          : null
      }
      countLabel={countLabel}
      dueLabel={a.dueLabel}
      dueSoon={state === "ontrack" && a.dueSoon}
      onOpen={onOpen}
    />
  );
}

export interface VideoInterviewsBodyProps {
  overdue: AwardInterviews[];
  onTrack: AwardInterviews[];
  statusLegend: string[];
}

/** The Video Interview board: awards past their first-draft deadline beside the rest. */
export function VideoInterviewsBody({ overdue, onTrack, statusLegend }: VideoInterviewsBodyProps) {
  const colors = buildStatusColors(statusLegend, DONE_COLORS);
  const key = (a: AwardInterviews) => `${a.domain}:${a.award}`;
  return (
    <CardBoard
      statusLegend={statusLegend}
      colors={colors}
      refreshCache={[cachePrefixes.ceoVideoInterviews]}
      details={(a) => ({
        title: a.award,
        summary:
          (a.pending === 0
            ? `All ${a.total} first drafts sent`
            : `${a.pending} of ${a.total} first drafts not yet sent`) +
          (a.deadline ? ` · draft deadline ${a.deadline} (${a.dueLabel})` : ` · ${a.dueLabel}`),
        items: a.items,
        extraLabel: "1st draft",
        doneLabel: "draft sent",
      })}
      columns={[
        {
          label: "Draft overdue · past deadline",
          state: "overdue",
          rows: overdue,
          empty: "Nothing overdue — every past-deadline draft is out.",
          getKey: key,
          renderCard: (a, open) => <AwardCard a={a} state="overdue" colors={colors} onOpen={open} />,
        },
        {
          label: "On track · deadline ahead",
          state: "ontrack",
          rows: onTrack,
          empty: "No awards with drafts outstanding.",
          getKey: key,
          renderCard: (a, open) => <AwardCard a={a} state="ontrack" colors={colors} onOpen={open} />,
        },
      ]}
    />
  );
}
