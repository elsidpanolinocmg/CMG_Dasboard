"use client";

import { cachePrefixes } from "@/lib/cache/keys";
import { BoardCard, backlogSeverity, buildStatusColors, CardBoard, type CardState } from "./CeoCardBoard";
import type { MagazineBrand } from "@/lib/ceo-magazine/materials";

/** The three finished states are greens: On page, then Approved, then Proceed by default. */
const DONE_COLORS: Record<string, string> = {
  "on page": "#0ca30c",
  approved: "#34c759",
  "proceed by default": "#6fcf6f",
};

/** One magazine brand as a card: % done, status mix, what's late or in progress, and the deadline. */
function BrandCard({
  b,
  state,
  colors,
  onOpen,
}: {
  b: MagazineBrand;
  state: CardState;
  colors: Map<string, string>;
  onOpen?: () => void;
}) {
  const severity = backlogSeverity(b.done, b.total, b.overdueCount);
  const count = state === "overdue" ? b.overdueCount : b.outstanding;
  // On track with nothing left reads "Completed" rather than "0 in progress".
  const countLabel =
    state === "ontrack" && b.outstanding === 0
      ? "Completed"
      : `${count} ${state === "overdue" ? "overdue" : "in progress"}`;
  return (
    <BoardCard
      name={b.brand}
      pct={b.total ? Math.round((b.done / b.total) * 100) : 0}
      statuses={b.statuses}
      total={b.total}
      colors={colors}
      state={state}
      flag={state === "overdue" ? { severity, title: `${b.overdueCount} past deadline — ${severity} backlog` } : null}
      countLabel={countLabel}
      dueLabel={b.dueLabel}
      dueSoon={state === "ontrack" && b.dueSoon}
      onOpen={onOpen}
    />
  );
}

export interface MagazineMaterialsBodyProps {
  overdue: MagazineBrand[];
  onTrack: MagazineBrand[];
  statusLegend: string[];
}

/** The Magazine Materials board: brands with a past-deadline material beside the rest. */
export function MagazineMaterialsBody({ overdue, onTrack, statusLegend }: MagazineMaterialsBodyProps) {
  const colors = buildStatusColors(statusLegend, DONE_COLORS);
  return (
    <CardBoard
      statusLegend={statusLegend}
      colors={colors}
      refreshCache={[cachePrefixes.ceoMagazineMaterials]}
      details={(b) => ({
        title: b.brand,
        summary:
          b.outstanding === 0
            ? `All ${b.total} materials done`
            : `${b.outstanding} of ${b.total} materials not yet done · ${b.dueLabel}`,
        items: b.items,
        nameLabel: "Company",
        extraLabel: "Issue",
      })}
      columns={[
        {
          label: "Overdue · past deadline",
          state: "overdue",
          rows: overdue,
          empty: "Nothing overdue — every past-deadline material is done.",
          getKey: (b) => b.brand,
          renderCard: (b, open) => <BrandCard b={b} state="overdue" colors={colors} onOpen={open} />,
        },
        {
          label: "On track · deadline ahead",
          state: "ontrack",
          rows: onTrack,
          empty: "No brands with materials outstanding.",
          getKey: (b) => b.brand,
          renderCard: (b, open) => <BrandCard b={b} state="ontrack" colors={colors} onOpen={open} />,
        },
      ]}
    />
  );
}
