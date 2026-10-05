"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DashboardControls from "@/components/DashboardControls";
import YouTubeSlidePlayer from "@/components/YouTubeSlidePlayer";

type Live =
  | { status: "live"; id: string; title: string; channelName?: string; subtitles?: boolean }
  | { status: "blocked"; id: string; channelName?: string }
  | { status: "offline"; channelName?: string };

// The status endpoint is edge-cached for a minute, so polling faster gains nothing.
const POLL_MS = 2 * 60 * 1000;

/**
 * The live stream of the channel set in Admin → YouTube channel, full screen
 * and nothing else. It checks every couple of minutes, so a stream that starts
 * later comes up on its own and a finished one gives way to the waiting screen.
 */
export default function EditorialLivePage() {
  const [live, setLive] = useState<Live | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/youtube/live", { cache: "no-store" });
        const data = (await res.json()) as Live;
        if (cancelled) return;
        // Keep the same object while the stream is unchanged, so the player
        // isn't rebuilt on every poll.
        setLive((prev) =>
          prev && prev.status === data.status && ("id" in prev ? prev.id : "") === ("id" in data ? data.id : "")
            ? prev
            : data,
        );
      } catch {
        /* keep showing what we have */
      }
    };
    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const channel = live?.channelName || "the channel";

  return (
    <div className="relative w-screen h-lvh bg-black overflow-hidden flex items-center justify-center text-white">
      {live?.status === "live" ? (
        <YouTubeSlidePlayer
          slideId="editorial-live"
          ids={[live.id]}
          subtitles={!!live.subtitles}
          muted={muted}
          resume={false}
        />
      ) : (
        <div className="max-w-xl px-6 text-center flex flex-col gap-3">
          {live === null ? (
            <p className="text-lg opacity-60">Checking for a live stream…</p>
          ) : live.status === "blocked" ? (
            <>
              <p className="text-2xl font-semibold">{channel} is live, but it can&apos;t be shown here</p>
              <p className="opacity-70">
                The stream&apos;s owner has switched off &ldquo;Allow embedding&rdquo; in
                YouTube Studio. Once it&apos;s switched on, the stream appears here by itself.
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-semibold">{channel} isn&apos;t live right now</p>
              <p className="opacity-70">The stream will start here by itself when it goes live.</p>
            </>
          )}
        </div>
      )}

      <DashboardControls>
        {live?.status === "live" && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
          >
            {muted ? "🔇 Sound off" : "🔊 Sound on"}
          </button>
        )}
        <Link
          href="/dashboard/editorial"
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          ← Back
        </Link>
      </DashboardControls>
    </div>
  );
}
