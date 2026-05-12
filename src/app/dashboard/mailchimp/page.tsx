import {
  fetchAllAudiences,
  fetchLeadSourceMovement,
  type MailchimpAudienceStats,
} from "@/lib/sources/mailchimp";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import MailchimpLeaderboard from "./MailchimpLeaderboard";
import BirthdayOverlay from "@/components/BirthdayOverlay";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WINDOW_DAYS = 7;

type MovementSnapshot = Awaited<ReturnType<typeof fetchLeadSourceMovement>>;

export default async function MailchimpPage({
  searchParams,
}: {
  searchParams: Promise<{ cache?: string }>;
}) {
  const params = await searchParams;
  const cache = getCache();
  const audiencesKey = cacheKeys.mailchimpAudiences();
  const engagementKey = cacheKeys.mailchimpEngagement();
  const movementKey = cacheKeys.mailchimpMovement(WINDOW_DAYS);

  if (params.cache === "clear") {
    await Promise.all([
      cache.invalidate(audiencesKey),
      cache.invalidate(engagementKey),
      cache.invalidate(movementKey),
    ]);
  }

  let audiences: MailchimpAudienceStats[];
  let engagement: MailchimpAudienceStats[];
  let movement: MovementSnapshot;
  try {
    [audiences, engagement, movement] = await Promise.all([
      cache.getOrLoad<MailchimpAudienceStats[]>(audiencesKey, () => fetchAllAudiences(), {
        ttlMs: ttls.MAILCHIMP_AUDIENCES,
        staleMs: ttls.MAILCHIMP_AUDIENCES_STALE,
      }),
      cache.getOrLoad<MailchimpAudienceStats[]>(engagementKey, () => fetchAllAudiences(), {
        ttlMs: ttls.MAILCHIMP_ENGAGEMENT,
        staleMs: ttls.MAILCHIMP_ENGAGEMENT_STALE,
      }),
      cache.getOrLoad<MovementSnapshot>(
        movementKey,
        () => fetchLeadSourceMovement(WINDOW_DAYS),
        { ttlMs: ttls.MAILCHIMP_MOVEMENT, staleMs: ttls.MAILCHIMP_MOVEMENT_STALE },
      ),
    ]);
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

  return (
    <>
      <MailchimpLeaderboard audiences={audiences} engagement={engagement} movement={movement} />
      <BirthdayOverlay />
    </>
  );
}
