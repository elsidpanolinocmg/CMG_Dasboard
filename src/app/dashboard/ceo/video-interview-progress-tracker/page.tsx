import { VideoInterviewsDashboard } from "@/components/ceo/VideoInterviewsDashboard";
import { loadVideoInterviews, type VideoInterviews } from "@/lib/ceo-video-interviews/interviews";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = { title: "Video Interview Progress Tracker — CMG Dashboard" };

export default async function CeoVideoInterviewsPage() {
  // A failed read degrades to an empty board with a caveat rather than a crash.
  let data: VideoInterviews = {
    inProduction: [],
    completed: [],
    totalInterviews: 0,
    totalDone: 0,
    totalCampaigns: 0,
    statusLegend: [],
    source: "none",
    warnings: [],
  };
  try {
    data = await loadVideoInterviews();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ceo-video-interviews] sheet unreadable:", err);
    data = { ...data, warnings: [`Could not read the video-interview sheet: ${message}`] };
  }

  return <VideoInterviewsDashboard data={data} live={data.source === "sheet"} />;
}
