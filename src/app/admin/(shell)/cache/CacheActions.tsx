"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CacheActions({ prefixes }: { prefixes: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  async function invalidate(prefix: string) {
    setBusy(prefix);
    setFeedback(null);
    const res = await fetch("/api/admin/cache/invalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix }),
    });
    setBusy(null);
    if (res.ok) {
      const body = await res.json();
      setFeedback(`Invalidated ${body.removed ?? 0} entries under "${prefix}"`);
      router.refresh();
    } else {
      setFeedback("Invalidation failed");
    }
  }

  return (
    <section className="flex flex-col gap-3 border border-black/10 dark:border-white/10 rounded-lg p-4">
      <h2 className="font-medium">Invalidate</h2>
      <div className="flex flex-wrap gap-2">
        {prefixes.map((p) => (
          <button
            key={p}
            type="button"
            disabled={busy === p}
            onClick={() => invalidate(p)}
            className="text-xs px-3 py-1.5 rounded border border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 font-mono"
          >
            {busy === p ? "…" : p}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-0">
          <span className="opacity-70">Custom prefix</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="ga4:active-now:"
          />
        </label>
        <button
          type="button"
          disabled={!custom.trim() || busy !== null}
          onClick={() => invalidate(custom.trim())}
          className="rounded bg-foreground text-background px-3 py-1 text-sm font-medium disabled:opacity-50"
        >
          Invalidate
        </button>
      </div>
      {feedback && <p className="text-xs opacity-70">{feedback}</p>}
    </section>
  );
}
