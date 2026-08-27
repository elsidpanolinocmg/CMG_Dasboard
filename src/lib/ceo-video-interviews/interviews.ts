import { resolveCeoSheetId } from "@/lib/ceo/sheet-binding";
import { getSheetsClient } from "@/lib/sources/googleOAuth";

/**
 * Reads the award-video-interview workbook: one tab per awards campaign, each on
 * the same template. Every interview runs from row 5 down — its production status
 * in column A, the client it belongs to in column D. The READ ME, Timeline and
 * Claude Cache tabs are not campaigns and are skipped.
 *
 * A row only counts as an interview when it names a client in column D (the top
 * rows carry the template's headings and editor notes, with no client).
 *
 * Progress is the journey to a finished cut: "Published" and "Approved" are
 * COMPLETE; every other live status is still IN PRODUCTION. "Cancelled" rows drop
 * out of the totals entirely.
 */

const INTERVIEWS_FROM_ROW = 5;

/** Tabs that are not awards campaigns. */
const NON_CAMPAIGN = new Set(["READ ME :)", "Timeline", "Claude Cache"]);

/** The sheet the CEO board links to, used when no admin binding / env var is set. */
const DEFAULT_SHEET_ID = "15teZgQ9NvEyAVUfPewoI4-gQzoNbam5qKyHwuhbdIYA";

/** Statuses that mean the video is finished (drives the % and the green segment). */
const DONE_STATUSES = new Set(["published", "approved"]);
/** Statuses that drop out of the totals altogether. */
const DROP_STATUSES = new Set(["cancelled"]);

type Cell = string | number | boolean | null | undefined;

export interface StatusSlice {
  /** The status as written in the sheet, e.g. "Published", "For client approval". */
  status: string;
  count: number;
}

export interface CampaignInterviews {
  /** The campaign (worksheet tab) name, e.g. "HCA". */
  campaign: string;
  /** Live interviews (Cancelled excluded). */
  total: number;
  /** Of those, how many are complete (Published or Approved). */
  done: number;
  /** Not yet complete. */
  outstanding: number;
  /** The status breakdown for the stacked bar — complete first, then by count. */
  statuses: StatusSlice[];
}

export interface VideoInterviews {
  /** Campaigns with work outstanding, most in-production first. */
  inProduction: CampaignInterviews[];
  /** Campaigns where every interview is complete, by name. */
  completed: CampaignInterviews[];
  totalInterviews: number;
  totalDone: number;
  totalCampaigns: number;
  /** Every status seen, complete first — for a shared legend. */
  statusLegend: string[];
  source: "sheet" | "none";
  warnings: string[];
}

const EMPTY: VideoInterviews = {
  inProduction: [],
  completed: [],
  totalInterviews: 0,
  totalDone: 0,
  totalCampaigns: 0,
  statusLegend: [],
  source: "none",
  warnings: [],
};

/** Complete statuses lead (Published then Approved); the rest fall by count. */
function byDoneThenCount(a: StatusSlice, b: StatusSlice): number {
  const ad = DONE_STATUSES.has(a.status.toLowerCase());
  const bd = DONE_STATUSES.has(b.status.toLowerCase());
  if (ad !== bd) return ad ? -1 : 1;
  // Within complete, keep Published ahead of Approved for a stable, readable order.
  if (ad && bd) {
    const ap = a.status.toLowerCase() === "published";
    const bp = b.status.toLowerCase() === "published";
    if (ap !== bp) return ap ? -1 : 1;
  }
  return b.count - a.count || a.status.localeCompare(b.status);
}

export async function loadVideoInterviews(): Promise<VideoInterviews> {
  const spreadsheetId = await resolveCeoSheetId(
    "ceo_video_interviews",
    process.env.CEO_VIDEO_INTERVIEWS_SHEET_ID ?? DEFAULT_SHEET_ID,
  );
  if (!spreadsheetId) return EMPTY;

  const sheets = getSheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const tabs = (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? "")
    .filter((t) => t && !NON_CAMPAIGN.has(t));

  if (tabs.length === 0) return { ...EMPTY, source: "sheet" };

  // Status (A) and client (D) beneath the template headings, one range per tab.
  const ranges = tabs.map((t) => `'${t}'!A${INTERVIEWS_FROM_ROW}:D500`);
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const valueRanges = res.data.valueRanges ?? [];

  const inProduction: CampaignInterviews[] = [];
  const completed: CampaignInterviews[] = [];
  let totalInterviews = 0;
  let totalDone = 0;
  let totalCampaigns = 0;
  // Union of statuses across all campaigns, keyed lower-case, first spelling kept.
  const legend = new Map<string, { display: string; count: number }>();

  tabs.forEach((campaign, i) => {
    const rows = (valueRanges[i]?.values ?? []) as Cell[][];

    let total = 0;
    let done = 0;
    const perStatus = new Map<string, { display: string; count: number }>();
    for (const row of rows) {
      const raw = String(row[0] ?? "").trim();
      const client = String(row[3] ?? "").trim();
      const key = raw.toLowerCase();
      // A real interview names a client and isn't cancelled.
      if (!client || DROP_STATUSES.has(key)) continue;
      const display = raw || "No status";
      const legendKey = raw ? key : "no status";
      total++;
      if (DONE_STATUSES.has(key)) done++;
      const bump = (m: Map<string, { display: string; count: number }>, k: string) => {
        const e = m.get(k);
        if (e) e.count++;
        else m.set(k, { display, count: 1 });
      };
      bump(perStatus, legendKey);
      bump(legend, legendKey);
    }

    if (total === 0) return; // a campaign with no interviews yet — skip it entirely

    const outstanding = total - done;
    const statuses: StatusSlice[] = [...perStatus.values()]
      .map((e) => ({ status: e.display, count: e.count }))
      .sort(byDoneThenCount);
    const row: CampaignInterviews = { campaign, total, done, outstanding, statuses };

    totalInterviews += total;
    totalDone += done;
    totalCampaigns++;
    if (outstanding > 0) inProduction.push(row);
    else completed.push(row);
  });

  inProduction.sort((a, b) => b.outstanding - a.outstanding || b.total - a.total || a.campaign.localeCompare(b.campaign));
  completed.sort((a, b) => b.total - a.total || a.campaign.localeCompare(b.campaign));

  const statusLegend = [...legend.values()]
    .map((e) => ({ status: e.display, count: e.count }))
    .sort(byDoneThenCount)
    .map((s) => s.status);

  return {
    inProduction,
    completed,
    totalInterviews,
    totalDone,
    totalCampaigns,
    statusLegend,
    source: "sheet",
    warnings: [],
  };
}
