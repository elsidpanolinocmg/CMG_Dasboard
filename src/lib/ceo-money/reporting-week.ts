import { fromEpochDay, toEpochDay, weekStart, type CivilDate, type EpochDay } from "@/lib/ceo/week";

/**
 * The money dashboard's reporting week.
 *
 * A Friday–Thursday week — SG bills its invoices every Friday, so a week runs
 * from one Friday's billing through the following Thursday. It shows the **most
 * recently completed** Fri–Thu week, and advances at **midnight Saturday** (not
 * Friday), so a week stays on screen through the whole of its following Friday.
 * On Fri 21 Aug it shows Fri 7 – Thu 13 Aug; at midnight Saturday it steps to
 * 14–20 Aug. It no longer waits on the latest invoice — the window is the
 * calendar's, not the data's.
 *
 * A Fri–Thu week already spans its weekend, so cash and revenue count the whole
 * `start`..`end` window with no extra folding.
 */

export interface ReportingWeek {
  /** Friday — the window opens here. */
  start: EpochDay;
  /** Thursday — the window closes here. */
  end: EpochDay;
  /** Friday — the label's first day. */
  labelStart: EpochDay;
  /** Thursday — the label's last day. */
  labelEnd: EpochDay;
}

/** The reporting week to display, given today's Singapore calendar day. */
export function reportingWeekFor(todayCivil: CivilDate): ReportingWeek {
  // Roll at midnight Saturday, not Friday, so a Fri–Thu week stays on screen for
  // the whole of its following Friday. Anchoring on yesterday pushes the weekly
  // boundary one day later without changing the Fri–Thu span itself.
  const anchorFriday = weekStart(toEpochDay(todayCivil) - 1);
  const labelStart = anchorFriday - 7; // one week back: the Fri–Thu week that most recently completed
  const labelEnd = labelStart + 6; // its Thursday
  return { start: labelStart, end: labelEnd, labelStart, labelEnd };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function short(day: EpochDay): string {
  const [, m, d] = fromEpochDay(day).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** `Fri 31 Jul – Thu 6 Aug 2026` — the reporting-week label. */
export function formatBusinessWeek(labelStart: CivilDate, labelEnd: CivilDate): string {
  const year = labelEnd.split("-")[0];
  return `Fri ${short(toEpochDay(labelStart))} – Thu ${short(toEpochDay(labelEnd))} ${year}`;
}
