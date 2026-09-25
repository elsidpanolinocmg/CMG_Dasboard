import type { EpochDay } from "@/lib/ceo/week";

/**
 * How far a deadline is from today, in words — "5 months overdue", "due in 6 days",
 * "due today". The `short` form abbreviates weeks and months ("4 wk overdue",
 * "2 mo overdue") for boards whose card footers are tight; days stay spelled out
 * either way, as those counts are small.
 */
export function humanizeDue(deadlineDay: EpochDay, todayDay: EpochDay, opts: { short?: boolean } = {}): string {
  const diff = todayDay - deadlineDay; // positive = overdue
  if (diff === 0) return "due today";
  const mag = Math.abs(diff);
  let span: string;
  if (mag < 14) span = `${mag} day${mag === 1 ? "" : "s"}`;
  else if (mag < 60) span = opts.short ? `${Math.round(mag / 7)} wk` : `${Math.round(mag / 7)} weeks`;
  else span = opts.short ? `${Math.round(mag / 30)} mo` : `${Math.round(mag / 30)} months`;
  return diff > 0 ? `${span} overdue` : `due in ${span}`;
}
