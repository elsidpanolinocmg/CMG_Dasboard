"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function NewBrandForm({
  departmentSlugs,
  knownGroups,
}: {
  departmentSlugs: string[];
  knownGroups: string[];
}) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [group, setGroup] = useState("");
  const [ga4PropertyId, setGa4PropertyId] = useState("");
  const [drupalDomain, setDrupalDomain] = useState("");
  const [active, setActive] = useState(true);
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDept(slug: string) {
    setSelectedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      slug: slug.trim(),
      displayName: displayName.trim(),
      active,
      departments: Array.from(selectedDepts),
    };
    if (group.trim()) body.group = group.trim();
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
    const created = slug.trim();
    setSlug("");
    setDisplayName("");
    setGroup("");
    setGa4PropertyId("");
    setDrupalDomain("");
    setActive(true);
    setSelectedDepts(new Set());
    router.push(`/admin/brands/${encodeURIComponent(created)}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3"
    >
      <h2 className="font-medium">Add brand</h2>
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
          <span className="opacity-70">Group</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            list="brand-groups"
            placeholder="(optional)"
          />
          <datalist id="brand-groups">
            {knownGroups.map((g) => (
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

      <div className="flex flex-col gap-2 text-sm">
        <span className="opacity-70">Departments</span>
        <div className="flex flex-wrap gap-3">
          {departmentSlugs.length === 0 && (
            <span className="text-xs opacity-60">
              No departments defined yet — create one first.
            </span>
          )}
          {departmentSlugs.map((d) => (
            <label key={d} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedDepts.has(d)}
                onChange={() => toggleDept(d)}
              />
              <span className="font-mono text-xs">{d}</span>
            </label>
          ))}
        </div>
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
