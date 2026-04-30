"use client";

import Link from "next/link";
import ShortsPlayer from "@/components/ShortsPlayer";
import EditorialVideosTicker from "@/components/EditorialVideosTicker";
import DashboardControls from "@/components/DashboardControls";
import WaitModeToggle from "@/components/WaitModeToggle";

export default function BizzconShortsPage() {
  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <div className="flex-1 min-h-0">
        <ShortsPlayer
          className="h-full"
          fetchUrl="/api/videos/classified?department=bizzcon&format=shorts"
        />
      </div>
      <EditorialVideosTicker department="bizzcon" />
      <DashboardControls>
        <WaitModeToggle />
        <Link
          href="/dashboard/bizzcon"
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          ← Back
        </Link>
      </DashboardControls>
    </div>
  );
}
