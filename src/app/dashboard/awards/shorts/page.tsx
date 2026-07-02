"use client";

import Link from "next/link";
import ShortsPlayer from "@/components/ShortsPlayer";
import EditorialVideosTicker from "@/components/EditorialVideosTicker";
import DashboardControls from "@/components/DashboardControls";
import WaitModeToggle from "@/components/WaitModeToggle";
import BirthdayOverlay from "@/components/BirthdayOverlay";
import ViewportFit from "@/components/ViewportFit";

export default function AwardsShortsPage() {
  return (
    <div className="h-lvh pt-safe flex flex-col bg-white overflow-hidden">
      <ViewportFit />
      <div className="flex-1 min-h-0">
        <ShortsPlayer
          className="h-full"
          fetchUrl="/api/videos/classified?department=awards&format=shorts"
          slots={1}
        />
      </div>
      <EditorialVideosTicker department="awards" newsSource="event-news" />
      <DashboardControls>
        <WaitModeToggle />
        <Link
          href="/dashboard/awards"
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          ← Back
        </Link>
      </DashboardControls>
      <BirthdayOverlay pageKey="dashboard/awards/shorts" />
    </div>
  );
}
