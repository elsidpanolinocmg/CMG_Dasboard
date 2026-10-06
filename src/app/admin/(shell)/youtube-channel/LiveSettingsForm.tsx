"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { youTubeChannelUrl } from "@/lib/youtube";
import type { LiveSetting, LiveSource, LiveWhenOffline } from "@/lib/rotation/liveSetting";

const INPUT =
  "border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent text-sm";

const SOURCES: { value: LiveSource; label: string; hint: string }[] = [
  {
    value: "same",
    label: "Same channel as the videos between pages",
    hint: "Follows the channel set above.",
  },
  {
    value: "channel",
    label: "A different channel",
    hint: "Shows whatever that channel is streaming.",
  },
  {
    value: "video",
    label: "One specific video or stream link",
    hint: "For a scheduled event. Before it starts YouTube shows its own countdown.",
  },
];

const OFFLINE: { value: LiveWhenOffline; label: string }[] = [
  { value: "message", label: "Show a waiting message" },
  { value: "videos", label: "Play the channel's recent videos until the stream starts" },
];

interface Props {
  initial: LiveSetting;
  sharedChannelName: string;
}

export default function LiveSettingsForm({ initial, sharedChannelName }: Props) {
  const router = useRouter();
  const [source, setSource] = useState(initial.source);
  const [channelInput, setChannelInput] = useState(
    initial.channelId ? youTubeChannelUrl(initial.channelId) : "",
  );
  const [videoInput, setVideoInput] = useState(
    initial.videoId ? `https://www.youtube.com/watch?v=${initial.videoId}` : "",
  );
  const [subtitles, setSubtitles] = useState(initial.subtitles);
  const [whenOffline, setWhenOffline] = useState(initial.whenOffline);
  const [offlineMessage, setOfflineMessage] = useState(initial.offlineMessage);
  const [showLink, setShowLink] = useState(initial.showLink);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (source === "channel" && !channelInput.trim()) {
      return setError("Please paste the channel link");
    }
    if (source === "video" && !videoInput.trim()) return setError("Please paste the video link");

    setBusy(true);
    // Only send links that changed, so a save doesn't re-check YouTube.
    const channelChanged =
      channelInput.trim() !== (initial.channelId ? youTubeChannelUrl(initial.channelId) : "");
    const res = await fetch("/api/admin/youtube/live-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        channelInput: channelChanged ? channelInput : "",
        videoInput,
        subtitles,
        whenOffline,
        offlineMessage,
        showLink,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const b = await res?.json().catch(() => ({}));
      return setError(b?.error || "Save failed");
    }
    setSavedAt(new Date());
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-black/10 dark:border-white/10 rounded-2xl p-6 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col gap-5"
    >
      <div>
        <h2 className="font-medium">Live page</h2>
        <p className="text-xs opacity-60 mt-1">
          Settings for{" "}
          <a href="/dashboard/editorial/live" target="_blank" rel="noreferrer" className="underline">
            /dashboard/editorial/live
          </a>
          , separate from the videos between pages.
        </p>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">What it shows</span>
        {SOURCES.map((s) => (
          <label key={s.value} className="flex items-start gap-2">
            <input
              type="radio"
              checked={source === s.value}
              onChange={() => setSource(s.value)}
              className="mt-0.5"
            />
            <span>
              {s.label}
              {s.value === "same" && sharedChannelName ? ` (${sharedChannelName})` : ""}
              <span className="block text-[11px] opacity-50">{s.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {source === "channel" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Channel link</span>
          <input
            className={INPUT}
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder="https://www.youtube.com/@channelname"
          />
          {initial.source === "channel" && initial.channelName && (
            <span className="text-[11px] opacity-50">Now: {initial.channelName}.</span>
          )}
        </label>
      )}

      {source === "video" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Video or live stream link</span>
          <input
            className={INPUT}
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
          />
          <span className="text-[11px] opacity-50">
            The link, a youtu.be share link, or the embed code.
          </span>
        </label>
      )}

      {source !== "video" && (
        <div className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">When the channel isn&apos;t live</span>
          {OFFLINE.map((o) => (
            <label key={o.value} className="flex items-center gap-2">
              <input
                type="radio"
                checked={whenOffline === o.value}
                onChange={() => setWhenOffline(o.value)}
              />
              {o.label}
            </label>
          ))}
          {whenOffline === "message" && (
            <label className="flex flex-col gap-1 mt-2">
              <span className="opacity-70">Waiting message (optional)</span>
              <textarea
                className={INPUT}
                rows={2}
                maxLength={300}
                value={offlineMessage}
                onChange={(e) => setOfflineMessage(e.target.value)}
                placeholder="The stream will start here by itself when it goes live."
              />
              <span className="text-[11px] opacity-50">
                Shown under &ldquo;… isn&apos;t live right now&rdquo;, e.g. &ldquo;Next live show:
                Monday 9am&rdquo;.
              </span>
            </label>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={subtitles} onChange={(e) => setSubtitles(e.target.checked)} />
          Show subtitles (when the video or stream has them)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showLink} onChange={(e) => setShowLink(e.target.checked)} />
          Show the Live link on the home page and in the Editorial controls
        </label>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {savedAt && !busy && !error && (
          <span className="text-xs opacity-60">
            Saved at {savedAt.toLocaleTimeString()}. Open Live screens pick it up when they next
            reload; use Refresh all screens to apply it now.
          </span>
        )}
      </div>
    </form>
  );
}
