import { plural, rowList, someOf } from "@/lib/ceo/data-notes";
import type { DetailItem } from "@/lib/ceo/detail-item";
import { humanizeDue } from "@/lib/ceo/due";
import { resolveCeoSheetId } from "@/lib/ceo/sheet-binding";
import { readSheetModifiedTime } from "@/lib/ceo/sheet-modified";
import { fromEpochDay, today, toEpochDay, type EpochDay } from "@/lib/ceo/week";
import { getSheetsClient } from "@/lib/sources/googleOAuth";

/**
 * Reads the "Short Form Videos" workbook, tab "2026": one row per video — the
 * awards programme in column A, the winner/client in column B, the production
 * status in column J and a running log of dated notes in column K ("Status
 * Updates"). A row counts as a video when it names a client in column B.
 *
 * A video is DONE once it has reached the client — "Sent to client", "Approved" or
 * "Proceed by default". "Cancelled" videos drop out of the totals.
 *
 * Deadlines are written into the Status Updates log as "deadline: 25 Sept"; the
 * last one in the log wins, so a revised deadline replaces the first. Dates the
 * client owes us ("submit materials by 6 April") are deliberately not read.
 *
 * Videos are grouped by awards programme. A programme goes in the OVERDUE column when
 * any of its videos is past its deadline and not yet sent, or when it still has
 * videos in production but no deadline logged for any of them; otherwise it is
 * ON TRACK.
 */

const TAB = "2026";
const FROM_ROW = 2; // row 1 holds the headers
const YEAR = 2026;

/** Column indexes (0-based) in the video template. */
const COL = { award: 0, client: 1, status: 9, updates: 10 } as const; // A, B, J, K

/** Statuses at or past "Sent to client" — the video has reached the client. */
const DONE_STATUSES = new Set(["sent to client", "approved", "proceed by default"]);
/** Statuses that drop out of the totals altogether. */
const DROP_STATUSES = new Set(["cancelled"]);

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export interface StatusSlice {
  status: string;
  count: number;
}

export interface AwardVideos {
  /** The awards programme, e.g. "Retail Asia Awards" (the trailing year dropped). */
  award: string;
  /** Live videos (Cancelled excluded). */
  total: number;
  /** Of those, how many have reached the client. */
  done: number;
  /** Still in production. */
  outstanding: number;
  /** Videos past their deadline and not yet sent. */
  overdueCount: number;
  /** Status breakdown for the stacked bar — done first, then by count. */
  statuses: StatusSlice[];
  /** Worst overdue when behind, else the soonest upcoming deadline, in words. */
  dueLabel: string;
  /** True when on track and the soonest deadline is within a week. */
  dueSoon: boolean;
  /** Videos still in production, but none of them has a deadline logged. */
  noDeadline: boolean;
  /** Every video behind the card, for its detail panel. */
  items: DetailItem[];
}

export interface ShortFormVideos {
  /**
   * Awards needing attention: a video past its deadline (most overdue first), then
   * awards still in production with no deadline logged at all.
   */
  overdue: AwardVideos[];
  /** Everything else — work ahead of its deadline, or all sent. */
  onTrack: AwardVideos[];
  totalVideos: number;
  totalDone: number;
  /** Videos past their deadline and not yet sent, across all awards. */
  totalOverdue: number;
  /** Every status seen, done first — for a shared legend. */
  statusLegend: string[];
  /** When the sheet was last edited, as ISO 8601, or null. */
  updatedAt: string | null;
  source: "sheet" | "none";
  warnings: string[];
}

export const EMPTY_SHORT_FORM_VIDEOS: ShortFormVideos = {
  overdue: [],
  onTrack: [],
  totalVideos: 0,
  totalDone: 0,
  totalOverdue: 0,
  statusLegend: [],
  updatedAt: null,
  source: "none",
  warnings: [],
};

type Cell = string | number | boolean | null | undefined;

/** Order the done statuses along the pipeline end: Approved, Proceed by default, Sent. */
const DONE_ORDER = ["approved", "proceed by default", "sent to client"];

/** Done statuses lead (in pipeline-end order); the rest fall by count. */
function byDoneThenCount(a: StatusSlice, b: StatusSlice): number {
  const ai = DONE_ORDER.indexOf(a.status.toLowerCase());
  const bi = DONE_ORDER.indexOf(b.status.toLowerCase());
  if (ai !== -1 || bi !== -1) {
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }
  return b.count - a.count || a.status.localeCompare(b.status);
}

function epochDay(year: number, month: number, day: number): EpochDay {
  return toEpochDay(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
}

/** An epoch day as a short date, e.g. "25 Sept". */
function formatDay(day: EpochDay): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${fromEpochDay(day)}T00:00:00Z`),
  );
}

/**
 * The last "deadline: <date>" in a Status Updates log, as an epoch day. Accepts
 * "25 Sept" and "Sept 25". Each log line starts with the MM-DD it was written; a
 * deadline that falls well before that note (a December note saying "deadline:
 * 10 Jan") is taken to be the following year.
 */
function parseDeadline(log: string): EpochDay | null {
  let found: EpochDay | null = null;
  for (const line of log.split("\n")) {
    const noted = /^\s*(\d{1,2})-(\d{1,2})\b/.exec(line);
    const re = /deadline\s*:?\s*(?:(\d{1,2})\s+([A-Za-z]+)|([A-Za-z]+)\s+(\d{1,2}))/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const day = Number(m[1] ?? m[4]);
      const month = MONTHS[(m[2] ?? m[3]).toLowerCase().slice(0, 3)];
      if (!month || day < 1 || day > 31) continue;
      let when = epochDay(YEAR, month, day);
      if (noted) {
        const notedDay = epochDay(YEAR, Number(noted[1]), Number(noted[2]));
        if (when < notedDay - 60) when = epochDay(YEAR + 1, month, day);
      }
      found = when; // later mentions win
    }
  }
  return found;
}

export async function loadShortFormVideos(): Promise<ShortFormVideos> {
  // An admin-panel binding (purpose "ceo_short_form_videos") wins; the env var is
  // the fallback for deployments configured before the binding existed.
  const spreadsheetId = await resolveCeoSheetId(
    "ceo_short_form_videos",
    process.env.CEO_SHORT_FORM_VIDEOS_SHEET_ID,
  );
  if (!spreadsheetId) return EMPTY_SHORT_FORM_VIDEOS;

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${TAB}'!A${FROM_ROW}:K2000`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (res.data.values as Cell[][] | undefined) ?? [];
  const todayDay = toEpochDay(today());

  type Group = {
    award: string;
    total: number;
    done: number;
    overdueCount: number;
    worstOverdue: EpochDay | null;
    soonestUpcoming: EpochDay | null;
    perStatus: Map<string, StatusSlice>;
    items: DetailItem[];
  };
  const groups = new Map<string, Group>();
  // Keyed lower-case so "HOLD" and "HOLD " fold together; first spelling is shown.
  const legend = new Map<string, StatusSlice>();

  // Rows the board had to skip or couldn't fully read, per award, for the notes chip.
  type AwardNotes = {
    noDeadline: Array<{ row: number; client: string }>;
    badDeadline: Array<{ row: number; text: string }>;
    noStatus: number[];
  };
  const awardNotes = new Map<string, AwardNotes>();
  const noAwardRows: number[] = [];

  for (const [idx, r] of rows.entries()) {
    const client = String(r[COL.client] ?? "").trim();
    if (!client) continue;
    const sheetRow = FROM_ROW + idx;
    const writtenStatus = String(r[COL.status] ?? "").trim();
    const status = writtenStatus || "No status";
    const key = status.toLowerCase();
    if (DROP_STATUSES.has(key)) continue;

    const writtenAward = String(r[COL.award] ?? "").trim();
    if (!writtenAward) noAwardRows.push(sheetRow);
    const award = writtenAward.replace(/\s+20\d\d$/, "") || "Unassigned";
    let n = awardNotes.get(award);
    if (!n) {
      n = { noDeadline: [], badDeadline: [], noStatus: [] };
      awardNotes.set(award, n);
    }
    if (!writtenStatus) n.noStatus.push(sheetRow);
    let g = groups.get(award);
    if (!g) {
      g = { award, total: 0, done: 0, overdueCount: 0, worstOverdue: null, soonestUpcoming: null, perStatus: new Map(), items: [] };
      groups.set(award, g);
    }
    g.total++;
    const isDone = DONE_STATUSES.has(key);
    if (isDone) g.done++;

    // Only unsent videos can be late or due.
    const log = String(r[COL.updates] ?? "");
    const deadline = isDone ? null : parseDeadline(log);
    if (!isDone && deadline === null) {
      const mention = log.split("\n").find((line) => /deadline/i.test(line));
      if (mention) n.badDeadline.push({ row: sheetRow, text: mention.trim().slice(0, 60) });
      else n.noDeadline.push({ row: sheetRow, client });
    }
    g.items.push({
      name: client,
      status,
      done: isDone,
      late: deadline !== null && deadline < todayDay,
      deadline: deadline !== null ? formatDay(deadline) : undefined,
    });
    if (deadline !== null) {
      if (deadline < todayDay) {
        g.overdueCount++;
        if (g.worstOverdue === null || deadline < g.worstOverdue) g.worstOverdue = deadline;
      } else if (g.soonestUpcoming === null || deadline < g.soonestUpcoming) {
        g.soonestUpcoming = deadline;
      }
    }

    const s = g.perStatus.get(key);
    if (s) s.count++;
    else g.perStatus.set(key, { status, count: 1 });
    const l = legend.get(key);
    if (l) l.count++;
    else legend.set(key, { status, count: 1 });
  }

  const notes: string[] = [];
  const have = (count: number) => (count === 1 ? "has" : "have");
  if (noAwardRows.length) {
    notes.push(
      `${plural(noAwardRows.length, "video")} ${have(noAwardRows.length)} no awards name in column A (${rowList(noAwardRows)}), so ${noAwardRows.length === 1 ? "it's" : "they're"} grouped as "Unassigned".`,
    );
  }
  for (const [award, n] of awardNotes) {
    if (n.noDeadline.length) {
      notes.push(
        `${award}: ${plural(n.noDeadline.length, "video")} in production ${have(n.noDeadline.length)} no "deadline:" note in column K — ${someOf(n.noDeadline.map((v) => v.client))} (${rowList(n.noDeadline.map((v) => v.row))}).`,
      );
    }
    if (n.badDeadline.length) {
      notes.push(
        `${award}: couldn't read the deadline note on ${rowList(n.badDeadline.map((v) => v.row))} (${someOf(n.badDeadline.map((v) => v.text))}).`,
      );
    }
    if (n.noStatus.length) {
      notes.push(`${award}: ${plural(n.noStatus.length, "video")} ${have(n.noStatus.length)} no status in column J (${rowList(n.noStatus)}).`);
    }
  }

  const overdue: AwardVideos[] = [];
  const onTrack: AwardVideos[] = [];
  let totalVideos = 0;
  let totalDone = 0;
  let totalOverdue = 0;
  for (const g of groups.values()) {
    const outstanding = g.total - g.done;
    const dueLabel =
      g.worstOverdue !== null
        ? humanizeDue(g.worstOverdue, todayDay)
        : g.soonestUpcoming !== null
          ? humanizeDue(g.soonestUpcoming, todayDay)
          : outstanding > 0
            ? "no deadline set"
            : `${g.total} video${g.total === 1 ? "" : "s"}`;
    const noDeadline = outstanding > 0 && g.worstOverdue === null && g.soonestUpcoming === null;
    const entry: AwardVideos = {
      award: g.award,
      total: g.total,
      done: g.done,
      outstanding,
      overdueCount: g.overdueCount,
      statuses: [...g.perStatus.values()].sort(byDoneThenCount),
      dueLabel,
      dueSoon: g.overdueCount === 0 && g.soonestUpcoming !== null && g.soonestUpcoming - todayDay <= 7,
      noDeadline,
      items: g.items,
    };
    totalVideos += g.total;
    totalDone += g.done;
    totalOverdue += g.overdueCount;
    // Work with no deadline at all can't be judged on time, so it's flagged alongside
    // the late awards rather than looking safely "on track".
    if (g.overdueCount > 0 || noDeadline) overdue.push(entry);
    else onTrack.push(entry);
  }

  // Late awards first (most late videos first), then the undated ones.
  overdue.sort(
    (a, b) =>
      Number(a.noDeadline) - Number(b.noDeadline) ||
      b.overdueCount - a.overdueCount ||
      b.outstanding - a.outstanding ||
      a.award.localeCompare(b.award),
  );
  // Work still to do first (nearest deadline first via outstanding), then the finished ones.
  onTrack.sort((a, b) => b.outstanding - a.outstanding || b.total - a.total || a.award.localeCompare(b.award));

  const statusLegend = [...legend.values()].sort(byDoneThenCount).map((s) => s.status);
  const updatedAt = (await readSheetModifiedTime(spreadsheetId)) ?? new Date().toISOString();

  return {
    overdue,
    onTrack,
    totalVideos,
    totalDone,
    totalOverdue,
    statusLegend,
    updatedAt,
    source: "sheet",
    warnings: notes,
  };
}
