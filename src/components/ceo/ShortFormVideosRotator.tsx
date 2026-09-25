"use client";

import { cachePrefixes } from "@/lib/cache/keys";
import { BoardCard, backlogSeverity, buildStatusColors, CardBoard, type CardState } from "./CeoCardBoard";
import type { AwardVideos } from "@/lib/ceo-sfv/sheet";

/**
 * The three "reached the client" states are greens — Approved deepest, then Proceed
 * by default, then Sent to client — so the bar reads from done back up the pipeline.
 */
const DONE_COLORS: Record<string, string> = {
  approved: "#0ca30c",
  "proceed by default": "#34c759",
  "sent to client": "#6fcf6f",
};

/** One awards programme as a card: % sent, status mix, what's late or in production, and the deadline. */
function AwardCard({
  a,
  state,
  colors,
  onOpen,
}: {
  a: AwardVideos;
  state: CardState;
  colors: Map<string, string>;
  onOpen?: () => void;
}) {
  // A late award counts its late videos and carries the flag; an undated one in the
  // same column isn't late, so it counts what's still in production instead.
  const late = a.overdueCount > 0;
  const severity = backlogSeverity(a.done, a.total, a.overdueCount);
  const countLabel = late
    ? `${a.overdueCount} overdue`
    : a.outstanding === 0
      ? "Completed"
      : `${a.outstanding} in production`;
  return (
    <BoardCard
      name={a.award}
      nameTitle={a.award}
      pct={a.total ? Math.round((a.done / a.total) * 100) : 0}
      statuses={a.statuses}
      total={a.total}
      colors={colors}
      state={state}
      flag={late ? { severity, title: `${a.overdueCount} past deadline — ${severity} backlog` } : null}
      countLabel={countLabel}
      dueLabel={a.dueLabel}
      dueSoon={state === "ontrack" && a.dueSoon}
      onOpen={onOpen}
    />
  );
}

export interface ShortFormVideosBodyProps {
  overdue: AwardVideos[];
  onTrack: AwardVideos[];
  statusLegend: string[];
}

/** The Short Form Videos board: late or undated awards beside the ones on track. */
export function ShortFormVideosBody({ overdue, onTrack, statusLegend }: ShortFormVideosBodyProps) {
  const colors = buildStatusColors(statusLegend, DONE_COLORS);
  return (
    <CardBoard
      statusLegend={statusLegend}
      colors={colors}
      refreshCache={[cachePrefixes.ceoShortFormVideos]}
      details={(a) => ({
        title: a.award,
        summary:
          a.outstanding === 0
            ? `All ${a.total} videos sent to the client`
            : `${a.outstanding} of ${a.total} videos not yet sent · ${a.dueLabel}`,
        items: a.items,
        doneLabel: "sent",
      })}
      columns={[
        {
          label: "Overdue · past or no deadline",
          state: "overdue",
          rows: overdue,
          empty: "Nothing overdue — every video in production has a deadline ahead.",
          getKey: (a) => a.award,
          renderCard: (a, open) => <AwardCard a={a} state="overdue" colors={colors} onOpen={open} />,
        },
        {
          label: "On track · deadline ahead",
          state: "ontrack",
          rows: onTrack,
          empty: "No awards on track.",
          getKey: (a) => a.award,
          renderCard: (a, open) => <AwardCard a={a} state="ontrack" colors={colors} onOpen={open} />,
        },
      ]}
    />
  );
}
