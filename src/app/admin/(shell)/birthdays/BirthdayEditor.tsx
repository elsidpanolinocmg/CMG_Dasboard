"use client";

import { useState, type FormEvent } from "react";
import { upload } from "@vercel/blob/client";
import type { ClientBirthday } from "./BirthdaysManager";

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(month: number): number {
  // Use a non-leap year unless February is selected; for the picker we just
  // allow 29 if it's the user's actual birthday on a leap-year boundary.
  if (month === 2) return 29;
  return new Date(2025, month, 0).getDate();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function newId(displayName: string, month: number, day: number): string {
  const base = slugify(displayName) || "birthday";
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}-${mm}${dd}-${rand}`;
}

interface Props {
  mode: "create" | "edit";
  initial?: ClientBirthday;
  onSaved: () => void;
  onCancel: () => void;
}

export default function BirthdayEditor({ mode, initial, onSaved, onCancel }: Props) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [birthMonth, setBirthMonth] = useState(initial?.birthMonth ?? 1);
  const [birthDay, setBirthDay] = useState(initial?.birthDay ?? 1);
  const [active, setActive] = useState(initial?.active ?? true);
  const [hideGreeting, setHideGreeting] = useState(initial?.hideGreeting ?? false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError("Name is required");
      return;
    }
    if (mode === "create" && !file) {
      setError("Please choose an image or video file");
      return;
    }

    setBusy(true);

    const id = initial?.id ?? newId(displayName, birthMonth, birthDay);
    let mediaPath = initial?.mediaPath ?? "";
    let mediaKind: "image" | "video" = initial?.mediaKind ?? "image";

    if (file) {
      const ext = EXT_BY_TYPE[file.type];
      if (!ext) {
        setBusy(false);
        setError(`Unsupported file type: ${file.type || "unknown"}`);
        return;
      }
      const kind: "image" | "video" = file.type.startsWith("video/")
        ? "video"
        : "image";
      try {
        // Upload straight from the browser to Vercel Blob. The file does not
        // pass through our serverless function, so it is not capped at ~4.5 MB.
        const blob = await upload(`birthdays/${id}.${ext}`, file, {
          access: "public",
          contentType: file.type,
          handleUploadUrl: "/api/admin/birthdays/upload",
          clientPayload: JSON.stringify({
            id,
            mediaKind: kind,
            size: file.size,
            contentType: file.type,
          }),
        });
        mediaPath = blob.url;
        mediaKind = kind;
      } catch (err) {
        setBusy(false);
        setError(err instanceof Error ? err.message : "Upload failed");
        return;
      }
    }

    const body = {
      id,
      displayName: displayName.trim(),
      birthMonth,
      birthDay,
      mediaKind,
      mediaPath,
      active,
      hideGreeting,
    };

    const res = await fetch("/api/admin/birthdays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error || "Save failed");
      return;
    }
    onSaved();
  }

  const dayMax = daysInMonth(birthMonth);
  const dayOptions = Array.from({ length: dayMax }, (_, i) => i + 1);

  return (
    <form
      onSubmit={onSubmit}
      className="border border-black/10 dark:border-white/10 rounded-2xl p-6 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col gap-3"
    >
      <h2 className="font-medium">
        {mode === "create" ? "Add birthday" : `Edit "${initial?.displayName}"`}
      </h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">Employee name</span>
        <input
          className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Month</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={birthMonth}
            onChange={(e) => {
              const m = Number(e.target.value);
              setBirthMonth(m);
              if (birthDay > daysInMonth(m)) setBirthDay(daysInMonth(m));
            }}
          >
            {MONTHS.map((label, i) => (
              <option key={i + 1} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Day</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={birthDay}
            onChange={(e) => setBirthDay(Number(e.target.value))}
          >
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">
          {mode === "create"
            ? "Image or video file"
            : "Replace media (leave blank to keep current)"}
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        {mode === "edit" && initial?.mediaPath && !file && (
          <span className="text-xs opacity-70">
            Current: {initial.mediaPath} ({initial.mediaKind})
          </span>
        )}
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Active
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={hideGreeting}
          onChange={(e) => setHideGreeting(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Hide greeting text
          <span className="block opacity-60 text-xs">
            When checked, the &ldquo;Happy Birthday, {displayName || "Name"}!&rdquo; caption
            won&apos;t appear over the image/video.
          </span>
        </span>
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : mode === "create" ? "Add" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm opacity-70 hover:opacity-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
