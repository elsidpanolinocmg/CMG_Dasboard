"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function BrandForm({ groups }: { groups: string[] }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [groupSlug, setGroupSlug] = useState("");
  const [ga4PropertyId, setGa4PropertyId] = useState("");
  const [drupalDomain, setDrupalDomain] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      slug: slug.trim(),
      displayName: displayName.trim(),
      active,
    };
    if (groupSlug.trim()) body.groupSlug = groupSlug.trim();
    if (ga4PropertyId.trim()) body.ga4PropertyId = ga4PropertyId.trim();
    if (drupalDomain.trim()) body.drupalDomain = drupalDomain.trim();
    const res = await fetch("/api/admin/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error || "Save failed");
      return;
    }
    setSlug("");
    setDisplayName("");
    setGroupSlug("");
    setGa4PropertyId("");
    setDrupalDomain("");
    setActive(true);
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
            placeholder="sbr"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Display name</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Singapore Business Review"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Group slug</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
            value={groupSlug}
            onChange={(e) => setGroupSlug(e.target.value)}
            list="brand-group-slugs"
            placeholder="(optional)"
          />
          <datalist id="brand-group-slugs">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">GA4 property ID</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
            value={ga4PropertyId}
            onChange={(e) => setGa4PropertyId(e.target.value)}
            placeholder="342649217"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm col-span-2">
          <span className="opacity-70">Drupal domain</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
            value={drupalDomain}
            onChange={(e) => setDrupalDomain(e.target.value)}
            placeholder="sbr.com.sg"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Active
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
