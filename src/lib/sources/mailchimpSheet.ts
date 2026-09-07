import "server-only";

import { resolveBinding } from "@/lib/sources/bindings";
import { getSheetsClient } from "@/lib/sources/googleOAuth";
import { readSheet } from "@/lib/sources/sheets";
import type {
  MailchimpSheetAudience,
  MailchimpSheetSnapshot,
} from "./mailchimpTypes";

/**
 * Reads the Mailchimp figures from the "Website, EDM, Newsletter Stats Tracker"
 * workbook instead of calling Mailchimp directly.
 *
 * The tab is written by a scheduled job that already talks to Mailchimp, so the
 * dashboard gets the same numbers without spending API calls, without the
 * 10-connection limit, and covering publications that have no API key in this
 * app's config at all.
 */

/**
 * Mailchimp is not a department, so its binding lives under this reserved scope
 * slug — the same arrangement the CEO dashboards use.
 */
export const MAILCHIMP_SCOPE = "mailchimp";
export const MAILCHIMP_STATS_PURPOSE = "mailchimp_stats" as const;

/** The tab name used when the binding names neither a gid nor a tab. */
export const DEFAULT_TAB = "Daily Subscribers Stats";

/**
 * The tab's numeric id. A gid survives a rename, a tab name does not — and this
 * tab has already been renamed once ("Live Dashboard Data" → "Daily Subscribers
 * Stats"), so the gid is what the loader trusts.
 */
export const DEFAULT_GID = 1495937790;

/**
 * Header names the loader looks for, lower-cased and stripped of spaces so a
 * renamed "Open Rate" or "open rate" still lands. Reading by header rather than
 * by column letter means inserting a column in the sheet cannot silently shift
 * every figure one place to the left.
 */
const COLUMNS = {
  title: ["title", "audience", "publication"],
  subscribers: ["subscribers", "members", "membercount"],
  openRate: ["openrate", "open"],
  clickRate: ["clickrate", "click"],
  unsubCount: ["unsubcount", "unsubscribes", "unsubs"],
  plus: ["plus7d", "plus", "added"],
  minusUns: ["minusuns", "unsubscribed"],
  minusCln: ["minuscln", "cleaned"],
  net: ["net"],
  target: ["target"],
  monthlyCost: ["monthlycost", "cost"],
  lastChecked: ["lastchecked", "updated"],
  note: ["note", "notes"],
} as const;

type ColumnKey = keyof typeof COLUMNS;

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Maps each known column to its index in the header row, or -1 when absent. */
function indexColumns(headers: string[]): Record<ColumnKey, number> {
  const normalized = headers.map(normalizeHeader);
  const out = {} as Record<ColumnKey, number>;
  for (const [key, aliases] of Object.entries(COLUMNS) as [
    ColumnKey,
    readonly string[],
  ][]) {
    out[key] = normalized.findIndex((h) => h !== "" && aliases.includes(h));
  }
  return out;
}

function cell(row: string[], idx: number): string {
  if (idx < 0) return "";
  return (row[idx] ?? "").trim();
}

/**
 * Numbers in this sheet arrive formatted — "35,000" targets, "S$282.00" costs,
 * and a "Free account" that is text rather than a figure at all. Anything that
 * is not a number comes back null so the dashboard can render "—" rather than a
 * misleading zero.
 */
function num(raw: string): number | null {
  if (raw === "") return null;
  const cleaned = raw.replace(/[,\s]/g, "").replace(/^[^\d+.-]*/, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lifetime unsubscribes as a share of everyone who ever joined, matching what
 * the Mailchimp API path derived from `unsubscribe_count`. Null when the sheet
 * leaves the count blank — several rows do.
 */
function unsubscribeRate(members: number | null, unsubs: number | null): number | null {
  if (members === null || unsubs === null) return null;
  const denominator = members + unsubs;
  if (denominator <= 0) return null;
  return (unsubs / denominator) * 100;
}

type ResolvedSheet = { spreadsheetId: string; tab: string; gid: number | null };

/** The spreadsheet the binding points at, or null when nothing is configured. */
async function resolveSheet(): Promise<ResolvedSheet | null> {
  let spreadsheetId = process.env.MAILCHIMP_STATS_SHEET_ID?.trim() || "";
  let tab = process.env.MAILCHIMP_STATS_SHEET_TAB?.trim() || DEFAULT_TAB;
  let gid: number | null = DEFAULT_GID;
  try {
    const binding = await resolveBinding(
      MAILCHIMP_SCOPE,
      MAILCHIMP_STATS_PURPOSE,
      "google_sheets",
    );
    const config = binding?.config as
      | { spreadsheetId?: unknown; sheetName?: unknown; gid?: unknown }
      | undefined;
    if (typeof config?.spreadsheetId === "string" && config.spreadsheetId.trim()) {
      spreadsheetId = config.spreadsheetId.trim();
      // Only take the binding's tab and gid when the binding also supplied the
      // sheet; either one from a different workbook means nothing here.
      gid = typeof config.gid === "number" && Number.isFinite(config.gid) ? config.gid : null;
      if (typeof config.sheetName === "string" && config.sheetName.trim()) {
        tab = config.sheetName.trim();
      }
    }
  } catch {
    // A settings-store outage falls back to the environment variables rather
    // than taking the dashboard down.
  }
  return spreadsheetId ? { spreadsheetId, tab, gid } : null;
}

/**
 * The tab's current name, looked up by gid.
 *
 * The binding stores both, but only the gid is stable — renaming a tab in
 * Google Sheets keeps its gid and changes its name, which would otherwise break
 * the dashboard silently. The configured name is the fallback for a binding
 * saved without a gid.
 */
async function currentTabName(
  spreadsheetId: string,
  gid: number | null,
  fallback: string,
): Promise<{ tab: string; renamedFrom: string | null }> {
  if (gid === null) return { tab: fallback, renamedFrom: null };
  try {
    const sheets = getSheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const match = (meta.data.sheets ?? []).find((s) => s.properties?.sheetId === gid);
    const title = match?.properties?.title;
    if (!title) return { tab: fallback, renamedFrom: null };
    return { tab: title, renamedFrom: title === fallback ? null : fallback };
  } catch {
    // Metadata is a convenience; a failure here just means we try the name we
    // were given, which is what the loader would have done anyway.
    return { tab: fallback, renamedFrom: null };
  }
}

export async function loadMailchimpSheet(): Promise<MailchimpSheetSnapshot> {
  const resolved = await resolveSheet();
  if (!resolved) {
    return {
      rows: [],
      lastChecked: null,
      tab: DEFAULT_TAB,
      warnings: [
        "No Mailchimp stats sheet is configured. Set the 'Mailchimp · Stats sheet' binding in Admin → Data bindings.",
      ],
    };
  }

  const { spreadsheetId } = resolved;
  const { tab, renamedFrom } = await currentTabName(
    spreadsheetId,
    resolved.gid,
    resolved.tab,
  );
  const sheet = await readSheet({
    spreadsheetId,
    sheetName: tab,
    range: `'${tab}'!A1:Z500`,
  });

  const warnings: string[] = [];
  if (renamedFrom) {
    warnings.push(
      `The tab was renamed from "${renamedFrom}" to "${tab}"; it was found by its id, so nothing broke. Update the binding's tab name when convenient.`,
    );
  }
  const idx = indexColumns(sheet.headers);
  if (idx.title < 0) {
    return {
      rows: [],
      lastChecked: null,
      tab,
      warnings: [
        `The '${tab}' tab has no Title column, so no audiences could be read.`,
      ],
    };
  }
  for (const required of ["subscribers", "openRate", "clickRate"] as ColumnKey[]) {
    if (idx[required] < 0) warnings.push(`Column "${required}" is missing from '${tab}'.`);
  }

  let lastChecked: string | null = null;
  const rows: MailchimpSheetAudience[] = [];

  for (const raw of sheet.rows) {
    const title = cell(raw, idx.title);
    if (title === "") continue;

    const subscribers = num(cell(raw, idx.subscribers));
    const unsubCount = num(cell(raw, idx.unsubCount));
    const stamp = cell(raw, idx.lastChecked);
    // Every row carries the same run timestamp; the latest wins if they drift.
    if (stamp && (lastChecked === null || stamp > lastChecked)) lastChecked = stamp;

    rows.push({
      title,
      subscribers,
      openRate: num(cell(raw, idx.openRate)),
      clickRate: num(cell(raw, idx.clickRate)),
      unsubCount,
      unsubRate: unsubscribeRate(subscribers, unsubCount),
      added: num(cell(raw, idx.plus)),
      unsubscribed: num(cell(raw, idx.minusUns)),
      cleaned: num(cell(raw, idx.minusCln)),
      net: num(cell(raw, idx.net)),
      target: num(cell(raw, idx.target)),
      // Kept as written — "S$282.00" and "Free account" both belong on screen
      // exactly as the sheet says them.
      monthlyCost: cell(raw, idx.monthlyCost) || null,
      note: cell(raw, idx.note) || null,
    });
  }

  if (rows.length === 0) {
    warnings.push(`No audience rows found on '${tab}'.`);
  }

  // The sheet is rewritten in place by its own job, so a read timed against a
  // rebuild can catch the same publication twice. Say so rather than quietly
  // showing it twice — the figures in a half-written tab are not trustworthy.
  const duplicates = [
    ...new Set(
      rows.map((r) => r.title).filter((t, i, all) => all.indexOf(t) !== i),
    ),
  ];
  if (duplicates.length > 0) {
    warnings.push(
      `'${tab}' listed ${duplicates.join(", ")} more than once — the sheet was probably mid-update. Refresh in a minute.`,
    );
  }

  return { rows, lastChecked, tab, warnings };
}
