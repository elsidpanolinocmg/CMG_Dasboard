"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type KnownPage = { key: string; label: string };

interface Props {
  known: KnownPage[];
  initialEnabled: string[];
}

export default function VisibilityPanel({ known, initialEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState<Set<string>>(new Set(initialEnabled));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/birthdays/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: Array.from(enabled) }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setSavedAt(new Date());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="font-semibold text-sm">Where birthday slides appear</div>
          <p className="text-xs opacity-70 mt-1 max-w-prose">
            By default, birthday slides only show on the three department landing
            pages. Tick additional pages to enable them there. Mobile phones never
            show birthday slides regardless of these settings.
          </p>
        </div>
        <div className="text-xs opacity-60 whitespace-nowrap">
          {savedAt && !saving && !error && (
            <>Saved at {savedAt.toLocaleTimeString()}</>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-1">
        {known.map((p) => {
          const checked = enabled.has(p.key);
          return (
            <label
              key={p.key}
              className="flex items-start gap-2 text-sm cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded px-2 py-1"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(p.key)}
                className="mt-0.5"
              />
              <span className={checked ? "" : "opacity-70"}>{p.label}</span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </section>
  );
}
