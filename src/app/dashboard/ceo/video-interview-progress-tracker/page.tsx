import { VideoInterviewsDashboard } from "@/components/ceo/VideoInterviewsDashboard";
import { cacheKeys } from "@/lib/cache";
import { loadCeoTracker } from "@/lib/ceo/cached-load";
import { today } from "@/lib/ceo/week";
import {
  EMPTY_VIDEO_INTERVIEWS,
  loadVideoInterviews,
  type VideoInterviews,
} from "@/lib/ceo-video-interviews/interviews";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = { title: "Video Interview Progress Tracker — CMG Dashboard" };

export default async function CeoVideoInterviewsPage() {
  // Read through the cache; a failed read falls back to the last good figures, and
  // with none saved yet, to an empty board that says so rather than a crash.
  let data: VideoInterviews = EMPTY_VIDEO_INTERVIEWS;
  let staleSince: string | null = null;
  try {
    ({ value: data, staleSince } = await loadCeoTracker(
      cacheKeys.ceoVideoInterviews(today()),
      "ceo-video-interviews:v3",
      loadVideoInterviews,
    ));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ceo-video-interviews] sheet unreadable:", err);
    data = { ...EMPTY_VIDEO_INTERVIEWS, warnings: [`Could not read the video-interview sheet: ${message}`] };
  }

  return <VideoInterviewsDashboard data={data} live={data.source === "sheet"} staleSince={staleSince} />;
}
