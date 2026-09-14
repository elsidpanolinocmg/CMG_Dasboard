"use client";

import { useState, type FormEvent } from "react";
import { upload } from "@vercel/blob/client";
import { isoToLocal, localToIso, slugify } from "../quick-links/QuickLinkFields";
import type { ClientCustomPage, RotationPage } from "./CustomPagesManager";

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const DURATIONS: { label: string; hours: number }[] = [
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 24 * 7 },
  { label: "2 weeks", hours: 24 * 14 },
  { label: "1 month", hours: 24 * 30 },
];

const INPUT =
  "border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent text-sm";

interface Props {
  mode: "create" | "edit";
  initial?: ClientCustomPage;
  rotationPages: RotationPage[];
  onSaved: () => void;
  onCancel: () => void;
}

export default function CustomPageEditor({ mode, initial, rotationPages, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [active, setActive] = useState(initial?.active ?? true);
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [startsAt, setStartsAt] = useState(isoToLocal(initial?.startsAt));
  const [endsAt, setEndsAt] = useState(isoToLocal(initial?.endsAt));
  const [showOnHome, setShowOnHome] = useState(initial?.showOnHome ?? true);
  const [rotationKeys, setRotationKeys] = useState<Set<string>>(
    new Set(initial?.rotationPageKeys ?? []),
  );
  const [includeInNext, setIncludeInNext] = useState(initial?.includeInNext ?? false);
  const [showTitle, setShowTitle] = useState(initial?.showTitle ?? false);
  const [finishVideo, setFinishVideo] = useState(initial?.finishVideo ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVideo = file ? file.type.startsWith("video/") : initial?.mediaKind === "video";
  const [rotationOn, setRotationOn] = useState((initial?.rotationPageKeys.length ?? 0) > 0);
  const inRotation = rotationOn && rotationKeys.size > 0;

  /** Turning rotation on starts with every page ticked; turning it off clears them. */
  function toggleRotation(on: boolean) {
    setRotationOn(on);
    setRotationKeys(on ? new Set(rotationPages.map((p) => p.key)) : new Set());
  }

  function toggleKey(key: string) {
    setRotationKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applyDuration(hours: number) {
    const start = startsAt || isoToLocal(new Date().toISOString());
    const end = new Date(new Date(start).getTime() + hours * 3600 * 1000);
    setStartsAt(start);
    setEndsAt(isoToLocal(end.toISOString()));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Title is required");
    if (mode === "create" && !file) return setError("Please choose an image or video file");
    const startIso = localToIso(startsAt);
    const endIso = localToIso(endsAt);
    if (startIso && endIso && Date.parse(endIso) <= Date.parse(startIso)) {
      return setError("The end must be after the start");
    }

    setBusy(true);
    const id =
      initial?.id ?? `${slugify(title) || "page"}-${Math.random().toString(36).slice(2, 6)}`;
    let mediaPath = initial?.mediaPath ?? "";
    let mediaKind: "image" | "video" = initial?.mediaKind ?? "image";

    if (file) {
      const ext = EXT_BY_TYPE[file.type];
      if (!ext) {
        setBusy(false);
        return setError(`Unsupported file type: ${file.type || "unknown"}`);
      }
      const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
      try {
        // Straight from the browser to Vercel Blob, so large videos aren't
        // capped by the serverless request-body limit. The timestamp keeps the
        // URL fresh when media is replaced, so screens don't show a cached copy.
        const blob = await upload(`custom-pages/${id}-${Date.now()}.${ext}`, file, {
          access: "public",
          contentType: file.type,
          handleUploadUrl: "/api/admin/birthdays/upload",
          clientPayload: JSON.stringify({ id, mediaKind: kind, size: file.size, contentType: file.type }),
        });
        mediaPath = blob.url;
        mediaKind = kind;
      } catch (err) {
        setBusy(false);
        return setError(err instanceof Error ? err.message : "Upload failed");
      }
    }

    const res = await fetch("/api/admin/custom-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: title.trim(),
        mediaKind,
        mediaPath,
        active,
        order: Number.isFinite(order) ? order : 0,
        // null clears a saved date; upsert only $sets what it is given.
        startsAt: startIso ?? null,
        endsAt: endIso ?? null,
        showOnHome,
        rotationPageKeys: rotationOn ? Array.from(rotationKeys) : [],
        includeInNext: inRotation ? includeInNext : false,
        showTitle,
        finishVideo: mediaKind === "video" ? finishVideo : false,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      return setError(b?.error || "Save failed");
    }
    // Replaced media: remove the old file so storage doesn't fill with orphans.
    if (file && initial?.mediaPath && initial.mediaPath !== mediaPath) {
      fetch("/api/admin/birthdays/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: initial.mediaPath }),
      }).catch(() => {});
    }
    onSaved();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-black/10 dark:border-white/10 rounded-2xl p-6 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col gap-4"
    >
      <h2 className="font-medium">
        {mode === "create" ? "Add custom page" : `Edit "${initial?.title}"`}
      </h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">Title</span>
        <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} required />
        <span className="text-[11px] opacity-50">Used as the link text on the home page.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">
          {mode === "create" ? "Image or video file" : "Replace media (leave blank to keep current)"}
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <span className="text-[11px] opacity-50">PNG, JPG, WebP, GIF, MP4 or WebM, up to 50 MB.</span>
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Switched on
          <span className="text-[11px] opacity-50">(off hides it everywhere, including its own link)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} />
          Show the title as a caption over the media
        </label>
        {isVideo && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={finishVideo} onChange={(e) => setFinishVideo(e.target.checked)} />
            In rotations, let the video finish before moving on (no looping)
          </label>
        )}
      </div>

      <fieldset className="border-t border-black/10 dark:border-white/10 pt-3 flex flex-col gap-2">
        <div className="text-xs uppercase tracking-wider opacity-60">Home page</div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showOnHome} onChange={(e) => setShowOnHome(e.target.checked)} />
          Show a link on the home page (under Quick links)
        </label>
        <label className="flex flex-col gap-1 text-sm max-w-40">
          <span className="opacity-70">Order</span>
          <input type="number" className={INPUT} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
          <span className="text-[11px] opacity-50">Lowest number first.</span>
        </label>
      </fieldset>

      <fieldset className="border-t border-black/10 dark:border-white/10 pt-3 flex flex-col gap-2">
        <div className="text-xs uppercase tracking-wider opacity-60">Rotation on other pages</div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rotationOn}
            onChange={(e) => toggleRotation(e.target.checked)}
          />
          Include in the rotation of other pages
        </label>
        {rotationOn && (
        <>
        <p className="text-[11px] opacity-60">
          All pages are ticked to start with. Untick any dashboard that shouldn&apos;t
          play this page. Phones never show rotation slides.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          {rotationPages.map((p) => (
            <label
              key={p.key}
              className="flex items-start gap-2 text-sm cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded px-2 py-1"
            >
              <input
                type="checkbox"
                checked={rotationKeys.has(p.key)}
                onChange={() => toggleKey(p.key)}
                className="mt-0.5"
              />
              <span className={rotationKeys.has(p.key) ? "" : "opacity-70"}>{p.label}</span>
            </label>
          ))}
        </div>
        <label className={`flex items-start gap-2 text-sm mt-1 ${inRotation ? "" : "opacity-40"}`}>
          <input
            type="checkbox"
            checked={inRotation && includeInNext}
            disabled={!inRotation}
            onChange={(e) => setIncludeInNext(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Also show it when clicking Next / Prev
            <span className="block text-[11px] opacity-60">
              Without this it only comes up on the automatic timer (like birthdays).
              Works on the Editorial, Awards and Bizzcon landing pages, which have
              Next buttons.
            </span>
          </span>
        </label>
        </>
        )}
      </fieldset>

      <fieldset className="border-t border-black/10 dark:border-white/10 pt-3 flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wider opacity-60">Schedule</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Show from</span>
            <input type="datetime-local" className={INPUT} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            <span className="text-[11px] opacity-50">Leave blank to start straight away.</span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Hide after</span>
            <input type="datetime-local" className={INPUT} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            <span className="text-[11px] opacity-50">Leave blank to keep it until you switch it off.</span>
          </label>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="opacity-60">Run for:</span>
          {DURATIONS.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => applyDuration(d.hours)}
              className="rounded border border-black/15 dark:border-white/15 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/5"
            >
              {d.label}
            </button>
          ))}
          {(startsAt || endsAt) && (
            <button
              type="button"
              onClick={() => {
                setStartsAt("");
                setEndsAt("");
              }}
              className="opacity-60 hover:opacity-100 underline underline-offset-2"
            >
              Clear schedule
            </button>
          )}
        </div>
        <p className="text-[11px] opacity-50">
          The schedule controls the home-page link and the rotation. Times follow this
          computer&apos;s timezone.
        </p>
      </fieldset>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : mode === "create" ? "Add" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm opacity-70 hover:opacity-100">
          Cancel
        </button>
      </div>
    </form>
  );
}
