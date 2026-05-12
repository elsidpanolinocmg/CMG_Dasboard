import {
  fetchCampaignWindowStats,
  type CampaignWindowStats,
} from "@/lib/sources/mailchimp";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import MailchimpReportsClient from "./MailchimpReportsClient";
import BirthdayOverlay from "@/components/BirthdayOverlay";
import { parseWindowDays } from "../windowDays";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ReportsSnapshot = Awaited<ReturnType<typeof fetchCampaignWindowStats>>;

export default async function MailchimpReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ cache?: string; days?: string }>;
}) {
  const params = await searchParams;
  const windowDays = parseWindowDays(params.days);
  const cache = getCache();
  const reportsKey = cacheKeys.mailchimpCampaignReports(windowDays);

  if (params.cache === "clear") {
    await cache.invalidate(reportsKey);
  }

  let snapshot: ReportsSnapshot;
  try {
    snapshot = await cache.getOrLoad<ReportsSnapshot>(
      reportsKey,
      () => fetchCampaignWindowStats(windowDays),
      { ttlMs: ttls.MAILCHIMP_REPORTS, staleMs: ttls.MAILCHIMP_REPORTS_STALE },
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

  // Strip server-only fields before passing to the client component.
  const safeRows: CampaignWindowStats[] = snapshot.perAudience;

  return (
    <>
      <MailchimpReportsClient
        rows={safeRows}
        grandTotals={snapshot.grandTotals}
        windowDays={snapshot.windowDays}
      />
      <BirthdayOverlay pageKey="dashboard/mailchimp/reports" />
    </>
  );
}
