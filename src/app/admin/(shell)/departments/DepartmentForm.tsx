"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function DepartmentForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [routePrefix, setRoutePrefix] = useState("");
  const [order, setOrder] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: slug.trim(),
        displayName: displayName.trim(),
        routePrefix: routePrefix.trim() || `/dashboard/${slug.trim()}`,
        order: Number(order),
        enabled,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error || "Save failed");
      return;
    }
    setSlug("");
    setDisplayName("");
    setRoutePrefix("");
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
          <span className="opacity-70">Slug</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="editorial"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Display name</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Editorial"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Route prefix</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
            value={routePrefix}
            onChange={(e) => setRoutePrefix(e.target.value)}
            placeholder="/dashboard/editorial"
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
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Enabled
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
