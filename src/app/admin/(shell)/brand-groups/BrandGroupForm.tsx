"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function BrandGroupForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/brand-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: slug.trim(), displayName: displayName.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error || "Save failed");
      return;
    }
    setSlug("");
    setDisplayName("");
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
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Display name</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>
      </div>
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
