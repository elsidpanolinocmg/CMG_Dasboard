"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DashboardControls from "@/components/DashboardControls";
import YouTubeSlidePlayer from "@/components/YouTubeSlidePlayer";

type LiveInfo = {
  subtitles?: boolean;
  whenOffline?: "message" | "videos";
  offlineMessage?: string;
} & (
  | { kind: "channel"; channelId: string; channelName?: string }
  | { kind: "video"; videoId: string }
);

// While the channel isn't live, look again this often.
const RETRY_MS = 2 * 60 * 1000;

const BUTTON = "px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60";

/**
 * The Editorial Live page, set up in Admin → YouTube channel → Live page.
 *
 * A channel source asks YouTube, from this browser, for the channel's current
 * stream. While there is none it shows the waiting screen or the channel's
 * recent uploads, and looks again every couple of minutes in a hidden player,
 * so a stream that starts later takes over by itself. A video source just
 * plays that one video (a scheduled stream shows YouTube's own countdown).
 */
export default function EditorialLivePage() {
  const [info, setInfo] = useState<LiveInfo | null>(null);
  const [liveUp, setLiveUp] = useState(false);
  // Sticks once a look finds nothing, so the fallback stays up between looks.
  const [notLive, setNotLive] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/youtube/live", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<LiveInfo>) : null))
      .then((data) => {
        if (!cancelled && data) setInfo(data);
      })
      .catch(() => {
        /* keep the last answer */
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (!notLive || liveUp) return;
    const t = setInterval(() => setAttempt((n) => n + 1), RETRY_MS);
    return () => clearInterval(t);
  }, [notLive, liveUp]);

  const onLiveChange = (playing: boolean) => {
    setLiveUp(playing);
    setNotLive(!playing);
  };

  const channelName = info?.kind === "channel" ? info.channelName || "The channel" : "";
  const showUploads =
    info?.kind === "channel" && !liveUp && notLive && info.whenOffline === "videos";
  const playingSomething = info?.kind === "video" || liveUp || showUploads;

  return (
    <div className="relative w-screen h-lvh bg-black overflow-hidden flex items-center justify-center text-white">
      {info?.kind === "video" && (
        <YouTubeSlidePlayer
          slideId="editorial-live-video"
          ids={[info.videoId]}
          subtitles={!!info.subtitles}
          muted={muted}
          resume={false}
        />
      )}

      {info?.kind === "channel" && (
        <>
          {showUploads && (
            <YouTubeSlidePlayer
              slideId="editorial-live-uploads"
              ids={[]}
              uploadsOf={info.channelId}
              subtitles={!!info.subtitles}
              muted={muted}
            />
          )}
          {/* Hidden until a stream is found; while hidden it only looks. */}
          <div className={`absolute inset-0 ${liveUp ? "" : "opacity-0"}`}>
            <YouTubeSlidePlayer
              key={`${info.channelId}-${attempt}`}
              slideId="editorial-live"
              ids={[]}
              liveChannel={info.channelId}
              subtitles={!!info.subtitles}
              muted={muted || !liveUp}
              onPlayingChange={onLiveChange}
            />
          </div>
        </>
      )}

      {!playingSomething && (
        <div className="relative max-w-xl px-6 text-center flex flex-col gap-3">
          {!notLive ? (
            <p className="text-lg opacity-60">Checking for a live stream…</p>
          ) : (
            <>
              <p className="text-2xl font-semibold">{channelName} isn&apos;t live right now</p>
              <p className="opacity-70 whitespace-pre-line">
                {info?.offlineMessage || "The stream will start here by itself when it goes live."}
              </p>
            </>
          )}
        </div>
      )}

      <DashboardControls>
        {playingSomething && (
          <button type="button" onClick={() => setMuted((m) => !m)} className={BUTTON}>
            {muted ? "🔇 Sound off" : "🔊 Sound on"}
          </button>
        )}
        <Link href="/dashboard/editorial" className={BUTTON}>
          ← Back
        </Link>
      </DashboardControls>
    </div>
  );
}
