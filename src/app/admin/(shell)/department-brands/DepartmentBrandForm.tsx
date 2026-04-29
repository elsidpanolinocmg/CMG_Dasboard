"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function DepartmentBrandForm({
  departmentSlugs,
  brandSlugs,
}: {
  departmentSlugs: string[];
  brandSlugs: string[];
}) {
  const router = useRouter();
  const [departmentSlug, setDepartmentSlug] = useState(departmentSlugs[0] ?? "");
  const [brandSlug, setBrandSlug] = useState(brandSlugs[0] ?? "");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!departmentSlug || !brandSlug) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/department-brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentSlug, brandSlug, enabled }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error || "Save failed");
      return;
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3"
    >
      <h2 className="font-medium">Link or update</h2>
      <div className="flex flex-wrap gap-3 items-end">
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
          <span className="opacity-70">Brand</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={brandSlug}
            onChange={(e) => setBrandSlug(e.target.value)}
            required
          >
            {brandSlugs.length === 0 && <option value="">(none)</option>}
            {brandSlugs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
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
        disabled={busy || !departmentSlug || !brandSlug}
        className="self-start rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
