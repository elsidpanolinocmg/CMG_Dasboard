"use client";

import { useState } from "react";

export default function TestBindingButton({
  departmentSlug,
  purpose,
  dataSourceKind,
}: {
  departmentSlug: string;
  purpose: string;
  dataSourceKind: string;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  async function probe() {
    setBusy(true);
    setResult(null);
    setOk(null);
    const res = await fetch("/api/admin/bindings/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentSlug, purpose, dataSourceKind }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    setOk(!!body.ok);
    if (body.ok) setResult(JSON.stringify(body.detail));
    else setResult(body.error || "failed");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={probe}
        className="text-xs px-2 py-1 rounded border border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
      >
        {busy ? "…" : "Test"}
      </button>
      {result && (
        <span
          className={`text-xs font-mono truncate max-w-xs ${
            ok ? "text-emerald-500" : "text-red-500"
          }`}
          title={result}
        >
          {result}
        </span>
      )}
    </div>
  );
}
