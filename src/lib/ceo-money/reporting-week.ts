import { fromEpochDay, toEpochDay, weekStart, type CivilDate, type EpochDay } from "@/lib/ceo/week";

/**
 * The money dashboard's reporting week.
 *
 * A Friday–Thursday week — SG bills its invoices every Friday, so a week runs
 * from one Friday's billing through the following Thursday. It is shown held back
 * to the **last fully-settled week** (two Fri–Thu weeks behind the current one,
 * i.e. one week after the most recent week closed), advancing every Friday in
 * Singapore time. On Fri 14 Aug it shows Fri 31 Jul – Thu 6 Aug; the next Friday
 * it steps to 7–13 Aug. It no longer waits on the latest invoice — the window is
 * the calendar's, not the data's.
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
  const thisFriday = weekStart(toEpochDay(todayCivil)); // Friday opening the current Fri–Thu week
  const labelStart = thisFriday - 14; // two weeks back: the last fully-settled week's Friday
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
