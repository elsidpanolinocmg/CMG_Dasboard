import { resolveCeoSheetId } from "@/lib/ceo/sheet-binding";
import { today, toEpochDay, type EpochDay } from "@/lib/ceo/week";
import { getSheetsClient } from "@/lib/sources/googleOAuth";

/**
 * Reads the client-deliverables workbook: one tab per awards campaign, each on
 * the same template. For every 2026 campaign, the deliverables run from row 18
 * down — the status in column A, the client in column B — and the campaign's
 * single deadline (a publication date) sits in B17.
 *
 * A row only counts as a deliverable when it names a client in column B: the
 * status column also carries the odd section divider ("WBA", "Email Interview")
 * with no client, and those are not deliverables.
 *
 * A deliverable is OVERDUE when its campaign's deadline has passed and it is not
 * yet "Done" (only "Done" means published). ON TRACK is the mirror: a future
 * deadline with work still outstanding. Cancelled rows drop out of the totals.
 */

const DELIVERABLES_FROM_ROW = 18;
const DEADLINE_CELL_ROW = 17;

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

type Cell = string | number | boolean | null | undefined;

export interface StatusSlice {
  /** The status as it reads in the sheet, e.g. "Done", "Vetting". */
  status: string;
  count: number;
}

export interface CampaignDeliverables {
  /** The campaign (worksheet tab) name, e.g. "HCAA 2026". */
  campaign: string;
  /** The deadline as written in the sheet, e.g. "March 27". Empty if unparsed. */
  deadline: string;
  /** Live deliverables (Cancelled excluded, client-less divider rows excluded). */
  total: number;
  /** Of those, how many are "Done" (published). */
  done: number;
  /** Not yet done. */
  outstanding: number;
  /** The status breakdown for the stacked bar — Done first, then by count. */
  statuses: StatusSlice[];
}

export interface ClientDeliverables {
  /** Past deadline with work outstanding, most overdue first. */
  overdue: CampaignDeliverables[];
  /** Future deadline with work outstanding, soonest deadline first. */
  onTrack: CampaignDeliverables[];
  totalOverdue: number;
  totalDone: number;
  totalDeliverables: number;
  /** Deliverables whose campaign deadline has passed. */
  totalPastDeadline: number;
  /** Every status seen across 2026 campaigns, Done first — for a shared legend. */
  statusLegend: string[];
  source: "sheet" | "none";
  warnings: string[];
}

const EMPTY: ClientDeliverables = {
  overdue: [],
  onTrack: [],
  totalOverdue: 0,
  totalDone: 0,
  totalDeliverables: 0,
  totalPastDeadline: 0,
  statusLegend: [],
  source: "none",
  warnings: [],
};

/** Done always leads; the rest fall by count (descending). */
function byDoneThenCount(a: StatusSlice, b: StatusSlice): number {
  const ad = a.status.toLowerCase() === "done";
  const bd = b.status.toLowerCase() === "done";
  if (ad !== bd) return ad ? -1 : 1;
  return b.count - a.count || a.status.localeCompare(b.status);
}

/** `"March 27"` → the epoch day of 27 March 2026, or null if it doesn't parse. */
function parseDeadline(raw: Cell): EpochDay | null {
  const m = /([A-Za-z]+)\s+(\d{1,2})/.exec(String(raw ?? "").trim());
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  const day = Number(m[2]);
  const iso = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return toEpochDay(iso);
}

export async function loadClientDeliverables(): Promise<ClientDeliverables> {
  const spreadsheetId = await resolveCeoSheetId(
    "ceo_client_deliverables",
    process.env.CEO_CLIENT_DELIVERABLES_SHEET_ID,
  );
  if (!spreadsheetId) return EMPTY;

  const sheets = getSheetsClient();

  // One tab per campaign; keep only 2026 ones (names contain "2026").
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const tabs = (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? "")
    .filter((t) => /2026/.test(t));

  if (tabs.length === 0) return { ...EMPTY, source: "sheet" };

  // Two ranges per tab in a single round-trip: the deadline cell and the
  // status+client columns beneath the deliverables.
  const ranges = tabs.flatMap((t) => [
    `'${t}'!B${DEADLINE_CELL_ROW}`,
    `'${t}'!A${DELIVERABLES_FROM_ROW}:B500`,
  ]);
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const valueRanges = res.data.valueRanges ?? [];

  const todayDay = toEpochDay(today());
  const overdue: CampaignDeliverables[] = [];
  const onTrack: Array<CampaignDeliverables & { deadlineDay: EpochDay }> = [];
  let totalOverdue = 0;
  let totalDone = 0;
  let totalDeliverables = 0;
  let totalPastDeadline = 0;
  // Union of statuses across all campaigns, for the shared legend. Keyed by
  // lower-case; the value keeps the first-seen spelling (so "GTG" stays "GTG").
  const legend = new Map<string, { display: string; count: number }>();

  tabs.forEach((campaign, i) => {
    const deadlineRaw = (valueRanges[2 * i]?.values?.[0]?.[0] ?? "") as Cell;
    const rows = (valueRanges[2 * i + 1]?.values ?? []) as Cell[][];

    const deadlineDay = parseDeadline(deadlineRaw);
    const pastDeadline = deadlineDay !== null && deadlineDay < todayDay;

    let total = 0;
    let done = 0;
    const perStatus = new Map<string, { display: string; count: number }>();
    for (const row of rows) {
      const raw = String(row[0] ?? "").trim();
      const key = raw.toLowerCase();
      const client = String(row[1] ?? "").trim();
      // A real deliverable names a client and isn't cancelled. Divider rows in the
      // status column ("WBA", "Email Interview") carry no client — skip them.
      if (!client || !raw || key === "cancelled") continue;
      total++;
      if (key === "done") done++;
      const bump = (m: Map<string, { display: string; count: number }>) => {
        const e = m.get(key);
        if (e) e.count++;
        else m.set(key, { display: raw, count: 1 });
      };
      bump(perStatus);
      bump(legend);
    }

    const outstanding = total - done;
    const statuses: StatusSlice[] = [...perStatus.values()]
      .map((e) => ({ status: e.display, count: e.count }))
      .sort(byDoneThenCount);
    const row: CampaignDeliverables = {
      campaign,
      deadline: String(deadlineRaw ?? "").trim(),
      total,
      done,
      outstanding,
      statuses,
    };

    totalDeliverables += total;
    totalDone += done;
    if (pastDeadline) totalPastDeadline += total;

    if (pastDeadline && outstanding > 0) {
      totalOverdue += outstanding;
      overdue.push(row);
    } else if (!pastDeadline && deadlineDay !== null && outstanding > 0) {
      onTrack.push({ ...row, deadlineDay });
    }
  });

  overdue.sort((a, b) => b.outstanding - a.outstanding || b.total - a.total || a.campaign.localeCompare(b.campaign));
  onTrack.sort((a, b) => a.deadlineDay - b.deadlineDay || a.campaign.localeCompare(b.campaign));

  const statusLegend = [...legend.values()]
    .map((e) => ({ status: e.display, count: e.count }))
    .sort(byDoneThenCount)
    .map((s) => s.status);

  return {
    overdue,
    onTrack: onTrack.map(({ deadlineDay: _d, ...c }) => c),
    totalOverdue,
    totalDone,
    totalDeliverables,
    totalPastDeadline,
    statusLegend,
    source: "sheet",
    warnings: [],
  };
}
