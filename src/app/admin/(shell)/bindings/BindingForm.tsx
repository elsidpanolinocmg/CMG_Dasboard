"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const PURPOSES = ["leaderboard", "sponsorship", "analytics", "content", "media"] as const;

export default function BindingForm({
  departmentSlugs,
  sourceKinds,
}: {
  departmentSlugs: string[];
  sourceKinds: string[];
}) {
  const router = useRouter();
  const [departmentSlug, setDepartmentSlug] = useState(departmentSlugs[0] ?? "");
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]>("leaderboard");
  const [dataSourceKind, setDataSourceKind] = useState(sourceKinds[0] ?? "");
  const [configText, setConfigText] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!departmentSlug || !dataSourceKind) return;
    let config: unknown;
    try {
      config = JSON.parse(configText);
    } catch {
      setError("Config must be valid JSON");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/bindings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentSlug,
        purpose,
        dataSourceKind,
        config,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error || "Save failed");
      return;
    }
    setConfigText("{}");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3"
    >
      <h2 className="font-medium">Add or update</h2>
      <div className="grid grid-cols-3 gap-3">
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
          <span className="opacity-70">Purpose</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as (typeof PURPOSES)[number])}
          >
            {PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Source kind</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={dataSourceKind}
            onChange={(e) => setDataSourceKind(e.target.value)}
            required
          >
            {sourceKinds.length === 0 && <option value="">(none)</option>}
            {sourceKinds.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">Config (JSON)</span>
        <textarea
          rows={4}
          className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          placeholder='{"spreadsheetId":"...","sheetName":"..."}'
        />
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy || !departmentSlug || !dataSourceKind}
        className="self-start rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
