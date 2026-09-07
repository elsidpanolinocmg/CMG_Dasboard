"use client";

import { useState } from "react";

/**
 * The quick-link inputs, shared by the add form and the inline row editor.
 *
 * Only the two fields that every link needs — the text and the URL — are shown
 * up front. Everything else (description, order, id, on/off, schedule) sits
 * behind "More options", which opens on its own when a row already has any of
 * them set, so nothing saved is ever hidden from the person editing it.
 */

export type QuickLinkDraft = {
  id: string;
  label: string;
  href: string;
  description: string;
  order: number;
  active: boolean;
  /** `datetime-local` values ("2026-09-02T14:30"), empty when unset. */
  startsAt: string;
  endsAt: string;
};

export const EMPTY_DRAFT: QuickLinkDraft = {
  id: "",
  label: "",
  href: "",
  description: "",
  order: 0,
  active: true,
  startsAt: "",
  endsAt: "",
};

/**
 * Turns "Staff Handbook 2026" into "staff-handbook-2026" so nobody has to
 * invent an identifier by hand. Only used to seed a new row's id — an existing
 * row keeps the id it was saved under, because that is what upsert matches on.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Bare domains are the common paste; without a scheme the browser treats them as a relative path. */
export function normalizeHref(href: string): string {
  const trimmed = href.trim();
  if (trimmed === "") return "";
  if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * `datetime-local` carries no timezone, so the browser's own zone is what the
 * person entering it means. Both helpers go through local time and store UTC,
 * which is what the home page compares against.
 */
export function localToIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function nowLocal(): string {
  return isoToLocal(new Date().toISOString());
}

/** True when the draft uses anything beyond the plain text-and-link case. */
function hasAdvanced(draft: QuickLinkDraft): boolean {
  return (
    draft.description.trim() !== "" ||
    draft.order !== 0 ||
    !draft.active ||
    draft.startsAt !== "" ||
    draft.endsAt !== ""
  );
}

/** Duration shortcuts, in hours, that set the end from the start. */
const DURATIONS: { label: string; hours: number }[] = [
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 24 * 7 },
  { label: "2 weeks", hours: 24 * 14 },
  { label: "1 month", hours: 24 * 30 },
];

const HOUR_MS = 3600 * 1000;

const INPUT =
  "border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent text-sm";

export default function QuickLinkFields({
  draft,
  onChange,
  busy,
  showId,
}: {
  draft: QuickLinkDraft;
  onChange: (next: QuickLinkDraft) => void;
  busy: boolean;
  /** New rows expose the auto-filled id; existing rows can't change theirs. */
  showId: boolean;
}) {
  // Seeded once from the initial draft: a row that already has advanced values
  // opens with them visible rather than tucked away.
  const [open, setOpen] = useState(() => hasAdvanced(draft));

  function set<K extends keyof QuickLinkDraft>(key: K, value: QuickLinkDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  /** Sets the end to `hours` after the start, defaulting the start to now. */
  function applyDuration(hours: number) {
    const start = draft.startsAt || nowLocal();
    const end = new Date(new Date(start).getTime() + hours * HOUR_MS);
    onChange({ ...draft, startsAt: start, endsAt: isoToLocal(end.toISOString()) });
  }

  const scheduleWarning =
    draft.startsAt && draft.endsAt && new Date(draft.endsAt) <= new Date(draft.startsAt)
      ? "The end is before the start, so this link will never show."
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Text</span>
          <input
            className={INPUT}
            value={draft.label}
            disabled={busy}
            placeholder="Staff handbook"
            onChange={(e) => {
              const label = e.target.value;
              // Keep the id tracking the label only while it is still
              // auto-derived, so a hand-edited id survives further typing.
              const autoId =
                showId && (draft.id === "" || draft.id === slugify(draft.label));
              onChange({ ...draft, label, id: autoId ? slugify(label) : draft.id });
            }}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Link</span>
          <input
            className={`${INPUT} font-mono text-xs`}
            value={draft.href}
            disabled={busy}
            placeholder="https://example.com/handbook"
            onChange={(e) => set("href", e.target.value)}
            required
          />
        </label>
      </div>

      <div className="border-t border-black/10 dark:border-white/10 pt-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] uppercase tracking-wider opacity-60 hover:opacity-100 flex items-center gap-1.5"
        >
          <span>{open ? "▾" : "▸"}</span>
          <span>More options</span>
          {!open && hasAdvanced(draft) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/15 normal-case tracking-normal">
              in use
            </span>
          )}
        </button>

        {open && (
          <div className="mt-3 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm md:col-span-2">
                <span className="opacity-70">Description</span>
                <input
                  className={INPUT}
                  value={draft.description}
                  disabled={busy}
                  placeholder="Shown in smaller text under the link."
                  onChange={(e) => set("description", e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="opacity-70">Order</span>
                <input
                  type="number"
                  className={INPUT}
                  value={draft.order}
                  disabled={busy}
                  onChange={(e) => set("order", Number(e.target.value))}
                />
                <span className="text-[11px] opacity-50">
                  Lowest number appears first.
                </span>
              </label>

              <div className="flex flex-col gap-1 text-sm">
                {showId && (
                  <label className="flex flex-col gap-1">
                    <span className="opacity-70">ID</span>
                    <input
                      className={`${INPUT} font-mono text-xs`}
                      value={draft.id}
                      disabled={busy}
                      onChange={(e) => set("id", e.target.value)}
                      required
                    />
                    <span className="text-[11px] opacity-50">
                      Filled in from the text. Saving with an existing ID replaces
                      that link.
                    </span>
                  </label>
                )}
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    disabled={busy}
                    onChange={(e) => set("active", e.target.checked)}
                  />
                  <span>Switched on</span>
                </label>
                <span className="text-[11px] opacity-50">
                  Off hides the link no matter what the schedule says.
                </span>
              </div>
            </div>

            <fieldset className="border-t border-black/10 dark:border-white/10 pt-3 flex flex-col gap-3">
              <legend className="sr-only">Schedule</legend>
              <div className="text-xs uppercase tracking-wider opacity-60">
                Schedule
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="opacity-70">Show from</span>
                  <input
                    type="datetime-local"
                    className={INPUT}
                    value={draft.startsAt}
                    disabled={busy}
                    onChange={(e) => set("startsAt", e.target.value)}
                  />
                  <span className="text-[11px] opacity-50">
                    Leave blank to show it straight away.
                  </span>
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="opacity-70">Hide after</span>
                  <input
                    type="datetime-local"
                    className={INPUT}
                    value={draft.endsAt}
                    disabled={busy}
                    onChange={(e) => set("endsAt", e.target.value)}
                  />
                  <span className="text-[11px] opacity-50">
                    Leave blank to keep it up until you switch it off.
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="opacity-60">Run for:</span>
                {DURATIONS.map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    disabled={busy}
                    onClick={() => applyDuration(d.hours)}
                    className="rounded border border-black/15 dark:border-white/15 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                  >
                    {d.label}
                  </button>
                ))}
                {(draft.startsAt || draft.endsAt) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onChange({ ...draft, startsAt: "", endsAt: "" })}
                    className="opacity-60 hover:opacity-100 underline underline-offset-2"
                  >
                    Clear schedule
                  </button>
                )}
              </div>

              <p className="text-[11px] opacity-50">
                Times follow this computer&apos;s timezone.
              </p>
              {scheduleWarning && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  {scheduleWarning}
                </p>
              )}
            </fieldset>
          </div>
        )}
      </div>
    </div>
  );
}
