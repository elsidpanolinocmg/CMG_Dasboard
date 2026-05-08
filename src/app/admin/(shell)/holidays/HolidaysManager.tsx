"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { PH_HOLIDAYS } from "./phHolidays";

export type ClientHoliday = {
  date: string; // "YYYY-MM-DD"
  label: string;
};

function formatPretty(iso: string): string {
  // Parse as a local date (avoid timezone shift from `new Date("YYYY-MM-DD")`).
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function HolidaysManager({ holidays }: { holidays: ClientHoliday[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [seedingPh, setSeedingPh] = useState(false);
  const [seedFeedback, setSeedFeedback] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...holidays].sort((a, b) => a.date.localeCompare(b.date)),
    [holidays],
  );

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!date || !label.trim()) {
      setError("Both date and label are required");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, label: label.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error || "Save failed");
      return;
    }
    setDate("");
    setLabel("");
    router.refresh();
  }

  async function onSeedPh() {
    if (
      !confirm(
        `Add ${PH_HOLIDAYS.length} known Philippine holidays for 2026 and 2027? Existing entries with the same date will be updated.`,
      )
    ) {
      return;
    }
    setSeedingPh(true);
    setSeedFeedback(null);
    let ok = 0;
    let failed = 0;
    for (const h of PH_HOLIDAYS) {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(h),
      });
      if (res.ok) ok++;
      else failed++;
    }
    setSeedingPh(false);
    setSeedFeedback(
      failed === 0
        ? `Seeded ${ok} Philippine holidays.`
        : `Seeded ${ok}, failed ${failed}.`,
    );
    router.refresh();
  }

  async function onDelete(h: ClientHoliday) {
    if (!confirm(`Delete holiday "${h.label}" on ${h.date}?`)) return;
    setBusyDate(h.date);
    const res = await fetch("/api/admin/holidays/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: h.date }),
    });
    setBusyDate(null);
    if (res.ok) router.refresh();
    else alert("Delete failed");
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onCreate}
        className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Date</span>
          <input
            type="date"
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-[14rem]">
          <span className="opacity-70">Label</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Christmas Day"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-foreground text-background px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : "+ Add holiday"}
        </button>
        {error && <p className="basis-full text-sm text-red-500">{error}</p>}
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSeedPh}
          disabled={seedingPh}
          className="rounded-lg border border-black/15 dark:border-white/15 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
        >
          {seedingPh ? "Adding…" : "Populate Philippine holidays (2026–2027)"}
        </button>
        {seedFeedback && (
          <span className="text-xs opacity-70">{seedFeedback}</span>
        )}
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center opacity-60">
                  No holidays yet.
                </td>
              </tr>
            )}
            {sorted.map((h) => (
              <tr
                key={h.date}
                className="border-t border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <td className="px-3 py-2 font-mono text-xs">
                  {h.date}
                  <span className="opacity-60 ml-2">({formatPretty(h.date)})</span>
                </td>
                <td className="px-3 py-2">{h.label}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={busyDate === h.date}
                    onClick={() => onDelete(h)}
                    className="text-xs text-red-600 hover:underline underline-offset-2 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
