"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Hint from "../_widgets/Hint";

export default function PageSettingsForm() {
  const router = useRouter();
  const [pageKey, setPageKey] = useState("");
  const [label, setLabel] = useState("");
  const [text, setText] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError("Settings must be valid JSON");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setError("Settings must be a JSON object");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/page-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageKey: pageKey.trim(),
        label: label.trim() || undefined,
        settings: parsed,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error || "Save failed");
      return;
    }
    setPageKey("");
    setLabel("");
    setText("{}");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3"
    >
      <h2 className="font-medium">
        Add custom page key
        <Hint>
          Use this for ad-hoc pages not in the known list above. The pageKey
          identifies the surface from code (e.g. <code>dashboard/awards/leaderboard</code>).
        </Hint>
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Page key</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
            value={pageKey}
            onChange={(e) => setPageKey(e.target.value)}
            placeholder="dashboard/section/page"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Label (optional)</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">Settings (JSON object)</span>
        <textarea
          rows={5}
          className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{"refreshMs": 1800000, "pageSize": 10}'
        />
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy || !pageKey.trim()}
        className="self-start rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
