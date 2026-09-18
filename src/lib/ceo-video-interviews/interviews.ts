import { google } from "googleapis";
import { resolveCeoSheetId } from "@/lib/ceo/sheet-binding";
import { today, toEpochDay, type EpochDay } from "@/lib/ceo/week";
import { getOAuth2Client, getSheetsClient } from "@/lib/sources/googleOAuth";

/**
 * Reads the award-video-interview workbook: one tab per DOMAIN (e.g. HKB, SBR),
 * each on the same template. Every interview runs from row 5 down — its production
 * status in column A, the award it belongs to in column B ("Event"), the client in
 * column D, and the first-draft link in column P. The READ ME, Timeline and Claude
 * Cache tabs are skipped.
 *
 * A domain can cover several awards, each with its own deadline: the "Deadline for
 * 1st draft" lives on the Timeline tab, keyed by the full award name. So interviews
 * are regrouped BY AWARD (via the Event label → Timeline award), giving each card a
 * single real deadline.
 *
 * The goal is a first draft out before that deadline: an interview's draft is SENT
 * when column P is filled. An award is DRAFT OVERDUE when its deadline has passed and
 * a first draft is still missing on one or more of its interviews; otherwise it is
 * ON TRACK. "Cancelled" interviews drop out of the totals.
 */

const INTERVIEWS_FROM_ROW = 5;
const YEAR = "2026";

const NON_CAMPAIGN = new Set(["READ ME :)", "Timeline", "Claude Cache"]);
const DROP_STATUSES = new Set(["cancelled"]);

/** Column indexes (0-based) in the interview template. */
const COL = { status: 0, event: 1, client: 3, firstDraft: 15 } as const; // A, B, D, P

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Single-award domains: the Event label is ignored, the domain maps to one award. */
const SINGLE_AWARD: Record<string, { display: string; award: string }> = {
  FINTECH: { display: "Fintech", award: "Fintech" },
  HCA: { display: "Healthcare Asia", award: "Healthcare Asia" },
  RA: { display: "Retail Asia", award: "Retail Asia" },
  REA: { display: "Real Estate Asia", award: "Real Estate Asia" },
  AT: { display: "Asian Telecom", award: "Asian Telecom" },
  GOV: { display: "GovMedia", award: "GovMedia" },
  IA: { display: "Insurance Asia", award: "Insurance Asia" },
  ESGB: { display: "ESGBusiness", award: "ESGBusiness Awards" },
  AP: { display: "Asian Power", award: "Asian Power" },
  "APB+": { display: "APB+", award: "APB+" },
};

/** Multi-award domains: each Event label maps to its own award (and deadline). */
const BY_LABEL: Record<string, Record<string, { display: string; award: string }>> = {
  HKB: {
    "hkb gba": { display: "HKB GBA", award: "HKB Greater Bay Area Enterprise" },
    "hkb mea": { display: "HKB MEA", award: "HKB Management Excellence" },
    "hkb tea": { display: "HKB TEA", award: "HKB Technology Excellence" },
  },
  SBR: {
    "sbr tea": { display: "SBR TEA", award: "SBR Technology Excellence" },
    "sbr iba": { display: "SBR IBA", award: "SBR National/International Business" },
    "sbr nba": { display: "SBR NBA", award: "SBR National/International Business" },
  },
  ABR: {
    amea: { display: "AMEA", award: "Asian Management Excellence" },
    mytea: { display: "MYTEA", award: "Malaysia Technology Excellence" },
    myiba: { display: "MYIBA", award: "Malaysia National/International Business" },
    mynba: { display: "MYNBA", award: "Malaysia National/International Business" },
    atea: { display: "ATEA", award: "Asian Technology Excellence" },
  },
  ABF: {
    "abf rba": { display: "ABF RBA", award: "Asian Banking & Finance" },
    "abf ciba": { display: "ABF CIBA", award: "Asian Banking & Finance" },
    "abf wba": { display: "ABF WBA", award: "Asian Banking & Finance" },
    fintech: { display: "ABF Fintech", award: "Fintech" },
  },
};

/** Resolve a row's (domain, Event label) to a display name and Timeline award. */
function resolveAward(domain: string, label: string): { display: string; award: string } {
  const byLabel = BY_LABEL[domain];
  if (byLabel) {
    const key = label.toLowerCase().trim();
    if (byLabel[key]) return byLabel[key];
    // A combined tag ("MYTEA, MYIBA") — take the first known label it contains.
    for (const k of Object.keys(byLabel)) if (key.includes(k)) return byLabel[k];
    return { display: label || domain, award: "" }; // unknown label — no deadline
  }
  const single = SINGLE_AWARD[domain];
  if (single) return single;
  return { display: domain, award: "" };
}

type Cell = string | number | boolean | null | undefined;

export interface StatusSlice {
  status: string;
  count: number;
}

export interface AwardInterviews {
  /** Display name for the card, e.g. "HKB TEA", "HCAA", "Fintech". */
  award: string;
  /** The domain tab it came from, e.g. "HKB". */
  domain: string;
  /** The deadline as written on the Timeline, e.g. "September 10"; "" if unknown. */
  deadline: string;
  /** Live interviews (Cancelled excluded). */
  total: number;
  /** Of those, how many have a first draft sent (column P filled). */
  draftsSent: number;
  /** First draft still not sent. */
  pending: number;
  /** Pending interviews whose deadline has passed. */
  overdueCount: number;
  /** Production status breakdown for the stacked bar. */
  statuses: StatusSlice[];
  /** Timing vs the deadline: "5 days overdue" / "due in 6 days". */
  dueLabel: string;
  /** True when on track and the deadline is within a week. */
  dueSoon: boolean;
}

export interface VideoInterviews {
  /** Awards past their draft deadline with a first draft still missing. */
  overdue: AwardInterviews[];
  /** Awards on track (deadline ahead, or all drafts sent). */
  onTrack: AwardInterviews[];
  totalInterviews: number;
  totalDraftsSent: number;
  /** Pending first drafts whose deadline has passed, across all awards. */
  totalOverdue: number;
  totalAwards: number;
  /** Every production status seen, for a shared legend. */
  statusLegend: string[];
  updatedAt: string | null;
  source: "sheet" | "none";
  warnings: string[];
}

const EMPTY: VideoInterviews = {
  overdue: [],
  onTrack: [],
  totalInterviews: 0,
  totalDraftsSent: 0,
  totalOverdue: 0,
  totalAwards: 0,
  statusLegend: [],
  updatedAt: null,
  source: "none",
  warnings: [],
};

/** A "1st draft" cell counts as sent when it holds a link/text, not a placeholder. */
function draftSent(cell: Cell): boolean {
  const s = String(cell ?? "").trim();
  if (!s) return false;
  return !/^(n\/?a|tbc|pending|-)$/i.test(s);
}

/** A Timeline deadline ("September 10", "February 3") → epoch day in 2026. */
function parseDeadline(raw: string): EpochDay | null {
  const m = /([A-Za-z]+)\s+(\d{1,2})/.exec(raw.trim());
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase().slice(0, 3)];
  const day = Number(m[2]);
  if (!month || day < 1 || day > 31) return null;
  return toEpochDay(`${YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
}

/** How far a deadline is from today, in words. */
function humanizeDue(deadlineDay: EpochDay | null, todayDay: EpochDay): string {
  if (deadlineDay === null) return "no deadline set";
  const diff = todayDay - deadlineDay;
  if (diff === 0) return "due today";
  const mag = Math.abs(diff);
  const span =
    mag < 14
      ? `${mag} day${mag === 1 ? "" : "s"}`
      : mag < 60
        ? `${Math.round(mag / 7)} wk`
        : `${Math.round(mag / 30)} mo`;
  return diff > 0 ? `${span} overdue` : `due in ${span}`;
}

/** The sheet's last-edit time from Drive (best-effort); null when unavailable. */
async function readSheetModifiedTime(spreadsheetId: string): Promise<string | null> {
  try {
    const drive = google.drive({ version: "v3", auth: getOAuth2Client() });
    const res = await drive.files.get({ fileId: spreadsheetId, fields: "modifiedTime", supportsAllDrives: true });
    return res.data.modifiedTime ?? null;
  } catch {
    return null;
  }
}

interface Group {
  award: string;
  domain: string;
  timelineAward: string;
  total: number;
  draftsSent: number;
  perStatus: Map<string, { display: string; count: number }>;
}

export async function loadVideoInterviews(): Promise<VideoInterviews> {
  const spreadsheetId = await resolveCeoSheetId(
    "ceo_video_interviews",
    process.env.CEO_VIDEO_INTERVIEWS_SHEET_ID,
  );
  if (!spreadsheetId) return EMPTY;

  const sheets = getSheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const domains = (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? "")
    .filter((t) => t && !NON_CAMPAIGN.has(t));

  if (domains.length === 0) return { ...EMPTY, source: "sheet" };

  // Timeline award → draft deadline, plus status/event/client/1st-draft per domain.
  const ranges = ["'Timeline'!A1:C60", ...domains.map((t) => `'${t}'!A${INTERVIEWS_FROM_ROW}:P400`)];
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const vr = res.data.valueRanges ?? [];

  // Award name (lower-case) → { deadline day, as-written }.
  const deadlines = new Map<string, { day: EpochDay | null; raw: string }>();
  for (const r of vr[0]?.values ?? []) {
    const programme = String(r[0] ?? "").trim();
    const raw = String(r[2] ?? "").trim();
    if (!programme || programme === "Awards Programme") continue;
    deadlines.set(programme.toLowerCase(), { day: parseDeadline(raw), raw });
  }

  const todayDay = toEpochDay(today());
  const groups = new Map<string, Group>();
  const legend = new Map<string, { display: string; count: number }>();

  domains.forEach((domain, i) => {
    const rows = (vr[i + 1]?.values ?? []) as Cell[][];
    for (const row of rows) {
      const status = String(row[COL.status] ?? "").trim();
      const client = String(row[COL.client] ?? "").trim();
      const key = status.toLowerCase();
      if (!client || DROP_STATUSES.has(key)) continue;

      const { display, award } = resolveAward(domain, String(row[COL.event] ?? "").trim());
      const gkey = `${domain}||${display}`;
      let g = groups.get(gkey);
      if (!g) {
        g = { award: display, domain, timelineAward: award, total: 0, draftsSent: 0, perStatus: new Map() };
        groups.set(gkey, g);
      }
      g.total++;
      if (draftSent(row[COL.firstDraft])) g.draftsSent++;

      const dStatus = status || "No status";
      const sKey = status ? key : "no status";
      const bumpS = g.perStatus.get(sKey);
      if (bumpS) bumpS.count++;
      else g.perStatus.set(sKey, { display: dStatus, count: 1 });
      const bumpL = legend.get(sKey);
      if (bumpL) bumpL.count++;
      else legend.set(sKey, { display: dStatus, count: 1 });
    }
  });

  const overdue: AwardInterviews[] = [];
  const onTrack: AwardInterviews[] = [];
  let totalInterviews = 0;
  let totalDraftsSent = 0;
  let totalOverdue = 0;

  for (const g of groups.values()) {
    if (g.total === 0) continue;
    const deadline = g.timelineAward ? deadlines.get(g.timelineAward.toLowerCase()) : undefined;
    const deadlineDay = deadline?.day ?? null;
    const pending = g.total - g.draftsSent;
    const pastDeadline = deadlineDay !== null && deadlineDay < todayDay;
    const overdueCount = pastDeadline ? pending : 0;
    const statuses = [...g.perStatus.values()]
      .map((e) => ({ status: e.display, count: e.count }))
      .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));

    const entry: AwardInterviews = {
      award: g.award,
      domain: g.domain,
      deadline: deadline?.raw ?? "",
      total: g.total,
      draftsSent: g.draftsSent,
      pending,
      overdueCount,
      statuses,
      dueLabel: humanizeDue(deadlineDay, todayDay),
      dueSoon: !pastDeadline && deadlineDay !== null && deadlineDay - todayDay <= 7,
    };

    totalInterviews += g.total;
    totalDraftsSent += g.draftsSent;
    totalOverdue += overdueCount;
    if (overdueCount > 0) overdue.push(entry);
    else onTrack.push(entry);
  }

  overdue.sort((a, b) => b.overdueCount - a.overdueCount || b.pending - a.pending || a.award.localeCompare(b.award));
  onTrack.sort((a, b) => b.pending - a.pending || a.award.localeCompare(b.award));

  const statusLegend = [...legend.values()]
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
    .map((e) => e.display);

  const updatedAt = (await readSheetModifiedTime(spreadsheetId)) ?? new Date().toISOString();

  return {
    overdue,
    onTrack,
    totalInterviews,
    totalDraftsSent,
    totalOverdue,
    totalAwards: overdue.length + onTrack.length,
    statusLegend,
    updatedAt,
    source: "sheet",
    warnings: [],
  };
}
