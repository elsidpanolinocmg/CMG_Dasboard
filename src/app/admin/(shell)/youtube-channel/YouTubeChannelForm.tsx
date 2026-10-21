"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { youTubeChannelUrl } from "@/lib/youtube";
import type { YouTubeChannelMode } from "@/lib/entities/customPage";
import type { YouTubeChannelSetting } from "@/lib/rotation/youtubeChannelSetting";

const INPUT =
  "border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent text-sm";

const MODES: { value: YouTubeChannelMode; label: string; hint: string }[] = [
  {
    value: "cycle",
    label: "Take turns with recent videos",
    hint: "Each time the slide comes up it shows the next video from the last few days.",
  },
  { value: "newest", label: "Newest video only", hint: "Always the latest upload." },
  {
    value: "live",
    label: "Live stream first, otherwise newest",
    hint: "Shows the live stream while the channel is live, otherwise the latest upload.",
  },
];

interface Props {
  initial: YouTubeChannelSetting;
  pages: { key: string; label: string }[];
  maxMinutes: number;
}

export default function YouTubeChannelForm({ initial, pages, maxMinutes }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [channelInput, setChannelInput] = useState(youTubeChannelUrl(initial.channelId));
  const [mode, setMode] = useState(initial.mode);
  const [days, setDays] = useState(initial.days);
  const [minutes, setMinutes] = useState(initial.slideSeconds / 60);
  const [spacing, setSpacing] = useState(initial.spacing);
  const [everyPages, setEveryPages] = useState(initial.everyPages);
  const [pageKeys, setPageKeys] = useState<Set<string>>(new Set(initial.pageKeys));
  const [subtitles, setSubtitles] = useState(initial.subtitles);
  const [includeInNext, setIncludeInNext] = useState(initial.includeInNext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function toggleKey(key: string) {
    setPageKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!channelInput.trim()) return setError("Please paste the YouTube channel link");
    if (!(days >= 1)) return setError("Days must be at least 1");
    if (!(minutes > 0 && minutes <= maxMinutes)) {
      return setError(`Minutes on screen must be between 0 and ${maxMinutes}`);
    }
    if (spacing === "fixed" && !(everyPages >= 1)) {
      return setError("Pages between videos must be at least 1");
    }

    setBusy(true);
    // Only send the link when it changed, so a save doesn't re-check YouTube.
    const changed = channelInput.trim() !== youTubeChannelUrl(initial.channelId);
    const res = await fetch("/api/admin/youtube/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled,
        channelInput: changed ? channelInput : "",
        mode,
        days,
        slideSeconds: Math.round(minutes * 60),
        spacing,
        everyPages,
        subtitles,
        includeInNext,
        pageKeys: Array.from(pageKeys),
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
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Show the channel&apos;s videos between pages
      </label>

      <fieldset
        disabled={!enabled}
        className={`flex flex-col gap-5 ${enabled ? "" : "opacity-50"}`}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">YouTube channel link</span>
          <input
            className={INPUT}
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder="https://www.youtube.com/@channelname"
          />
          <span className="text-[11px] opacity-50">
            Now: {initial.channelName || initial.channelId}. Paste a channel link or
            @handle to change it. Videos whose owner switched off embedding are skipped.
          </span>
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Which videos</span>
          {MODES.map((m) => (
            <label key={m.value} className="flex items-start gap-2">
              <input
                type="radio"
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="mt-0.5"
              />
              <span>
                {m.label}
                <span className="block text-[11px] opacity-50">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={subtitles}
            onChange={(e) => setSubtitles(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Show subtitles
            <span className="block text-[11px] opacity-50">
              Uses the video&apos;s English subtitles from YouTube, or the auto-generated
              ones. Videos with no subtitles play without.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeInNext}
            onChange={(e) => setIncludeInNext(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Also show it when clicking Next / Prev
            <span className="block text-[11px] opacity-50">
              Without this it only comes up on the timer. Next / Prev buttons are on the
              Editorial, Awards and Bizzcon landing pages.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {mode === "cycle" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Videos from the last (days)</span>
              <input
                type="number"
                min={1}
                className={INPUT}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
              <span className="text-[11px] opacity-50">
                Nothing shows while the channel has no videos this recent.
              </span>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Minutes on screen</span>
            <input
              type="number"
              min={0.5}
              max={maxMinutes}
              step={0.5}
              className={INPUT}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">How often</span>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              checked={spacing === "auto"}
              onChange={() => setSpacing("auto")}
              className="mt-0.5"
            />
            <span>
              Automatic, on the same schedule as birthdays
              <span className="block text-[11px] opacity-50">
                Spread evenly so it comes up once per full cycle of pages; every 5 minutes on
                dashboards that don&apos;t flip pages.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              checked={spacing === "fixed"}
              onChange={() => setSpacing("fixed")}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-2">
                After every
                <input
                  type="number"
                  min={1}
                  disabled={spacing !== "fixed"}
                  className={`${INPUT} w-16`}
                  value={everyPages}
                  onChange={(e) => setEveryPages(Number(e.target.value))}
                />
                pages
              </span>
              <span className="text-[11px] opacity-50">
                On dashboards that don&apos;t flip pages (leaderboards, shorts, videos), one
                page counts as one minute.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="opacity-70">Dashboards</span>
            <button
              type="button"
              onClick={() => setPageKeys(new Set(pages.map((p) => p.key)))}
              className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
            >
              Tick all
            </button>
            <button
              type="button"
              onClick={() => setPageKeys(new Set())}
              className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
            >
              Untick all
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {pages.map((p) => (
              <label
                key={p.key}
                className="flex items-start gap-2 text-sm cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded px-2 py-1"
              >
                <input
                  type="checkbox"
                  checked={pageKeys.has(p.key)}
                  onChange={() => toggleKey(p.key)}
                  className="mt-0.5"
                />
                <span className={pageKeys.has(p.key) ? "" : "opacity-70"}>{p.label}</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] opacity-50">Phones never show rotation slides.</p>
        </div>
      </fieldset>

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
            Saved at {savedAt.toLocaleTimeString()}. Open screens pick it up when they next
            reload; use Refresh all screens to apply it now.
          </span>
        )}
      </div>
    </form>
  );
}
