import * as pageSettings from "@/lib/repos/pageSettings";
import { loadMailchimpSheet } from "@/lib/sources/mailchimpSheet";
import type { MailchimpSheetSnapshot } from "@/lib/sources/mailchimpTypes";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import MailchimpLeaderboard from "./MailchimpLeaderboard";
import BirthdayOverlay from "@/components/BirthdayOverlay";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const MAILCHIMP_PAGE_KEY = "dashboard/mailchimp";

/**
 * How old the sheet's own reading may be before the board flags it. Its job
 * runs daily, so a day and a half allows for a late run without crying wolf.
 */
const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

/** Wallboard presentation settings, with the defaults the schema advertises. */
export type MailchimpDisplay = {
  pageSize: number;
  rotationMs: number;
  refreshMs: number;
};

const DISPLAY_DEFAULTS: MailchimpDisplay = {
  pageSize: 6,
  rotationMs: 60_000,
  // The sheet is rewritten once a day; three hours notices a new run without
  // re-reading a spreadsheet that has not changed.
  refreshMs: 180 * 60_000,
};

/**
 * Whether the sheet's reading predates its own daily run. Decided here rather
 * than in the client component: the page is rendered per request, so the server
 * clock is both current and the same for every viewer.
 */
function isStale(iso: string | null): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && Date.now() - t > STALE_AFTER_MS;
}

function positive(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * A settings-store failure falls back to the defaults entirely — the board must
 * not go dark because a rotation interval could not be read.
 */
async function loadDisplay(): Promise<MailchimpDisplay> {
  try {
    const doc = await pageSettings.findByKey(MAILCHIMP_PAGE_KEY);
    const s = (doc?.settings ?? {}) as Record<string, unknown>;
    return {
      pageSize: Math.round(positive(s.pageSize, DISPLAY_DEFAULTS.pageSize)),
      // Zero is meaningful for rotation ("pause"), so it is read on its own
      // terms rather than through the positive-or-default helper.
      rotationMs:
        typeof s.rotationSeconds === "number" && Number.isFinite(s.rotationSeconds)
          ? Math.max(0, s.rotationSeconds) * 1000
          : DISPLAY_DEFAULTS.rotationMs,
      refreshMs: positive(s.refreshMinutes, 180) * 60_000,
    };
  } catch {
    return DISPLAY_DEFAULTS;
  }
}

/**
 * The figures come from the stats spreadsheet, not from Mailchimp. A scheduled
 * job already reads Mailchimp into that sheet, so the dashboard shows the same
 * numbers without spending API calls — and covers the publications that have no
 * API key configured here at all.
 */
export default async function MailchimpPage({
  searchParams,
}: {
  searchParams: Promise<{ cache?: string }>;
}) {
  const params = await searchParams;
  const display = await loadDisplay();
  const cache = getCache();
  const key = cacheKeys.mailchimpSheet();

  if (params.cache === "clear") {
    await cache.invalidate(key);
  }

  let snapshot: MailchimpSheetSnapshot;
  try {
    snapshot = await cache.getOrLoad<MailchimpSheetSnapshot>(
      key,
      () => loadMailchimpSheet(),
      { ttlMs: ttls.MAILCHIMP_SHEET, staleMs: ttls.MAILCHIMP_SHEET_STALE },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
        <div className="rounded border border-red-300 bg-red-50 p-6 text-red-800 text-sm max-w-xl">
          {message}
        </div>
      </div>
    );
  }

  // Nothing to show and something to say about why — an unconfigured binding or
  // a renamed tab would otherwise render as a blank table with no explanation.
  if (snapshot.rows.length === 0) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center px-6">
        <div className="rounded border border-amber-300 bg-amber-50 p-6 text-amber-900 text-sm max-w-xl">
          <p className="font-semibold mb-2">No Mailchimp figures to show.</p>
          <ul className="list-disc pl-5 space-y-1">
            {snapshot.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
            {snapshot.warnings.length === 0 && (
              <li>The stats sheet returned no rows.</li>
            )}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <>
      <MailchimpLeaderboard
        snapshot={snapshot}
        display={display}
        sheetIsStale={isStale(snapshot.lastChecked)}
      />
      <BirthdayOverlay pageKey="dashboard/mailchimp" />
    </>
  );
}
