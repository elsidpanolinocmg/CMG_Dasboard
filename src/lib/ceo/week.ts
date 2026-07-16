/**
 * The reporting calendar every CEO dashboard shares: a Friday–Thursday week in
 * Singapore civil time, paced on business days.
 *
 * All date maths here happens in civil-date space: a date is a calendar day,
 * not an instant. Source rows carry no time and no zone, so converting them to
 * `Date` objects only invites the host's timezone to shift them across a
 * boundary. The single place a real instant enters this module is `today()`,
 * which resolves "now" into a Singapore calendar day and then leaves instants
 * behind for good.
 */

/** An ISO civil date, `YYYY-MM-DD`. No time, no zone. */
export type CivilDate = string;

/** Whole days since 1970-01-01, in civil-date space. */
export type EpochDay = number;

/** The business runs on Singapore civil time. Never inherit this from the host. */
export const TIMEZONE = "Asia/Singapore";

/** The reporting week runs Friday through Thursday. 0=Sun … 5=Fri … 6=Sat. */
export const WEEK_START_DOW = 5;

/** Fri, Mon, Tue, Wed, Thu. The Sat/Sun in the middle are not business days. */
export const BUSINESS_DAYS_PER_WEEK = 5;

/** Weeks of history shown in the trend charts. */
export const TREND_WEEKS = 13;

const DAY_MS = 86_400_000;

export function toEpochDay(date: CivilDate): EpochDay {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Not a civil date: ${date}`);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromEpochDay(day: EpochDay): CivilDate {
  const d = new Date(day * DAY_MS);
  const yyyy = String(d.getUTCFullYear()).padStart(4, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Today's calendar day in Singapore, regardless of where this code runs. */
export function today(now: Date = new Date()): CivilDate {
  // `en-CA` formats as YYYY-MM-DD, which is exactly our civil-date shape.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Parses a date typed by a human. Accepts `2026-06-19` and `6/19/26`, the two
 * forms this dashboard's users actually write. Month-first, because that is how
 * the accounts sheet is written.
 *
 * Returns null for anything that is not a real calendar day — `2026-02-30`
 * parses as a number triple but round-trips to 2 March, so the round-trip is
 * the validation.
 */
export function parseCivilDate(raw: string | undefined | null): CivilDate | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  let y: number, m: number, d: number;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  const slashed = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(trimmed);

  if (iso) {
    [, y, m, d] = iso.map(Number) as [number, number, number, number];
  } else if (slashed) {
    const [, month, day, year] = slashed.map(Number) as [number, number, number, number];
    m = month;
    d = day;
    y = year < 100 ? 2000 + year : year;
  } else {
    return null;
  }

  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const candidate = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return fromEpochDay(toEpochDay(candidate)) === candidate ? candidate : null;
}

/** 0=Sunday … 6=Saturday. Epoch day 0 (1970-01-01) was a Thursday. */
export function dayOfWeek(day: EpochDay): number {
  return ((day + 4) % 7 + 7) % 7;
}

export function isBusinessDay(day: EpochDay): boolean {
  const dow = dayOfWeek(day);
  return dow !== 0 && dow !== 6;
}

/** The Friday that opens the reporting week containing `day`. */
export function weekStart(day: EpochDay): EpochDay {
  const offset = ((dayOfWeek(day) - WEEK_START_DOW) % 7 + 7) % 7;
  return day - offset;
}

/** The Thursday that closes the reporting week containing `day`. */
export function weekEnd(day: EpochDay): EpochDay {
  return weekStart(day) + 6;
}

export function addDays(day: EpochDay, n: number): EpochDay {
  return day + n;
}

export function addWeeks(day: EpochDay, n: number): EpochDay {
  return day + n * 7;
}

/**
 * Business days elapsed in the week containing `asOf`, counting `asOf` itself.
 *
 * A Friday–Thursday week opens with one business day and then runs straight
 * into the weekend, so on Sunday night three of seven calendar days have passed
 * but only one of five business days. Pacing on calendar days would paint every
 * weekend red; this is why the tiles pace on business days instead.
 */
export function businessDaysElapsed(asOf: EpochDay): number {
  const start = weekStart(asOf);
  let count = 0;
  for (let d = start; d <= asOf; d++) {
    if (isBusinessDay(d)) count++;
  }
  return Math.min(count, BUSINESS_DAYS_PER_WEEK);
}

/** How far through its business days the week containing `asOf` is, in (0, 1]. */
export function weekPaceFraction(asOf: EpochDay): number {
  return businessDaysElapsed(asOf) / BUSINESS_DAYS_PER_WEEK;
}

export function daysBetween(from: CivilDate, to: CivilDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** Inclusive on both ends. */
export function isWithin(date: CivilDate, start: EpochDay, end: EpochDay): boolean {
  const d = toEpochDay(date);
  return d >= start && d <= end;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** `4 Jul` — short enough for an axis tick. */
export function formatShort(date: CivilDate): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** `Fri 4 Jul – Thu 10 Jul 2026` — the week label. */
export function formatWeekRange(start: CivilDate, end: CivilDate): string {
  const year = end.split("-")[0];
  return `Fri ${formatShort(start)} – Thu ${formatShort(end)} ${year}`;
}
