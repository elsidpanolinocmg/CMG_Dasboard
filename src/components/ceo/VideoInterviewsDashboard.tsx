import { CeoBoardShell } from "./CeoBoardShell";
import { VideoInterviewsBody } from "./VideoInterviewsRotator";
import type { VideoInterviews } from "@/lib/ceo-video-interviews/interviews";

export interface VideoInterviewsDashboardProps {
  data: VideoInterviews;
  live: boolean;
  /** Set when the sheet couldn't be read and saved figures are shown. */
  staleSince?: string | null;
}

/**
 * Award-video-interview draft progress against deadlines: a summary tile row, then a
 * bar per award split into two groups — draft overdue (deadline passed, a first draft
 * still missing) and on track (deadline ahead). Shares the CEO white theme.
 */
export function VideoInterviewsDashboard({ data, live, staleSince }: VideoInterviewsDashboardProps) {
  const { overdue, onTrack, totalInterviews, totalDraftsSent, totalOverdue, totalAwards, statusLegend, updatedAt } =
    data;
  const pctSent = totalInterviews ? Math.round((totalDraftsSent / totalInterviews) * 100) : 0;

  return (
    <CeoBoardShell
      title="Video Interview Progress Tracker"
      period="2026"
      updatedAt={updatedAt}
      staleSince={staleSince}
      live={live}
      notes={data.warnings}
      tiles={[
        { value: totalInterviews, label: "Interviews" },
        { value: pctSent, suffix: "%", label: `Drafts Sent · ${totalDraftsSent}/${totalInterviews}` },
        { value: totalOverdue, label: "Draft Overdue", state: "overdue" },
        { value: totalAwards, label: "Awards" },
      ]}
    >
      <VideoInterviewsBody overdue={overdue} onTrack={onTrack} statusLegend={statusLegend} />
    </CeoBoardShell>
  );
}
