"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const SUBPAGES = ["overview", "videos", "shorts", "leaderboard", "sponsorship"] as const;

export default function DashboardForm({ departmentSlugs }: { departmentSlugs: string[] }) {
  const router = useRouter();
  const [departmentSlug, setDepartmentSlug] = useState(departmentSlugs[0] ?? "");
  const [slug, setSlug] = useState<(typeof SUBPAGES)[number]>("overview");
  const [routePath, setRoutePath] = useState("");
  const [order, setOrder] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!departmentSlug) return;
    setBusy(true);
    setError(null);
    const path =
      routePath.trim() ||
      (slug === "overview"
        ? `/dashboard/${departmentSlug}`
        : `/dashboard/${departmentSlug}/${slug}`);
    const res = await fetch("/api/admin/dashboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentSlug,
        slug,
        routePath: path,
        order: Number(order),
        enabled,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error || "Save failed");
      return;
    }
    setRoutePath("");
    setOrder(0);
    setEnabled(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3"
    >
      <h2 className="font-medium">Add or update</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Department</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={departmentSlug}
            onChange={(e) => setDepartmentSlug(e.target.value)}
            required
          >
            {departmentSlugs.length === 0 && <option value="">(none)</option>}
            {departmentSlugs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Sub-page</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={slug}
            onChange={(e) => setSlug(e.target.value as (typeof SUBPAGES)[number])}
          >
            {SUBPAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm col-span-2">
          <span className="opacity-70">Route path</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
            value={routePath}
            onChange={(e) => setRoutePath(e.target.value)}
            placeholder="(auto)"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Order</span>
          <input
            type="number"
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm self-end pb-1">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy || !departmentSlug}
        className="self-start rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
