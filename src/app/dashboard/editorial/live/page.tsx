"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DashboardControls from "@/components/DashboardControls";
import YouTubeSlidePlayer from "@/components/YouTubeSlidePlayer";

interface LiveInfo {
  /** The server's own check; a hint only, since YouTube can hide streams from servers. */
  status: "live" | "blocked" | "offline";
  channelId?: string;
  channelName?: string;
  subtitles?: boolean;
}

// While nothing is playing, check again this often.
const RETRY_MS = 2 * 60 * 1000;

/**
 * The live stream of the channel set in Admin → YouTube channel, full screen
 * and nothing else. The browser asks YouTube for the channel's current stream
 * directly. When there is none it shows a waiting screen and tries again every
 * couple of minutes, so a stream that starts later comes up on its own.
 */
export default function EditorialLivePage() {
  const [info, setInfo] = useState<LiveInfo | null>(null);
  // null = still checking, true = stream playing, false = nothing to play.
  const [playing, setPlaying] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/youtube/live", { cache: "no-store" })
      .then((res) => res.json() as Promise<LiveInfo>)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {
        /* keep the last answer; the retry below tries again */
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Nothing playing: rebuild the player after a while to look again.
  useEffect(() => {
    if (playing !== false) return;
    const t = setTimeout(() => {
      setPlaying(null);
      setAttempt((n) => n + 1);
    }, RETRY_MS);
    return () => clearTimeout(t);
  }, [playing]);

  const channel = info?.channelName || "The channel";
  const blocked = info?.status === "blocked" || (info?.status === "live" && playing === false);

  return (
    <div className="relative w-screen h-lvh bg-black overflow-hidden flex items-center justify-center text-white">
      {info?.channelId && (
        <div className={`absolute inset-0 ${playing ? "" : "opacity-0"}`}>
          <YouTubeSlidePlayer
            key={attempt}
            slideId="editorial-live"
            ids={[]}
            liveChannel={info.channelId}
            subtitles={!!info.subtitles}
            muted={muted}
            onPlayingChange={setPlaying}
          />
        </div>
      )}

      {!playing && (
        <div className="relative max-w-xl px-6 text-center flex flex-col gap-3">
          {playing === null ? (
            <p className="text-lg opacity-60">Checking for a live stream…</p>
          ) : blocked ? (
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
        {playing && (
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
