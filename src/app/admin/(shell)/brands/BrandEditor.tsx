"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { humanize } from "@/lib/util/format";

export type ClientBrand = {
  slug: string;
  displayName: string;
  url: string;
  color: string;
  image: string;
  group: string;
  ga4PropertyId: string;
  ga4FilterFieldName: string;
  ga4FilterMatchType: string;
  ga4FilterValue: string;
  drupalDomain: string;
  awardsShowcaseId: string;
  departments: string[];
  active: boolean;
};

const FILTER_MATCH_TYPES = ["EXACT", "BEGINS_WITH", "ENDS_WITH", "CONTAINS"] as const;

export default function BrandEditor({
  brand,
  departmentSlugs,
  knownGroups,
}: {
  brand: ClientBrand;
  departmentSlugs: string[];
  knownGroups: string[];
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(brand.displayName);
  const [url, setUrl] = useState(brand.url);
  const [color, setColor] = useState(brand.color);
  const [group, setGroup] = useState(brand.group);
  const [ga4PropertyId, setGa4PropertyId] = useState(brand.ga4PropertyId);
  const [ga4FilterFieldName, setGa4FilterFieldName] = useState(brand.ga4FilterFieldName);
  const [ga4FilterMatchType, setGa4FilterMatchType] = useState(
    brand.ga4FilterMatchType || "EXACT",
  );
  const [ga4FilterValue, setGa4FilterValue] = useState(brand.ga4FilterValue);
  const [drupalDomain, setDrupalDomain] = useState(brand.drupalDomain);
  const [image, setImage] = useState(brand.image);
  const [awardsShowcaseId, setAwardsShowcaseId] = useState(brand.awardsShowcaseId);
  const [active, setActive] = useState(brand.active);
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set(brand.departments));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function toggleDept(slug: string) {
    setSelectedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    const body: Record<string, unknown> = {
      slug: brand.slug,
      displayName: displayName.trim(),
      active,
      departments: Array.from(selectedDepts),
    };
    if (url.trim()) body.url = url.trim();
    if (color.trim()) body.color = color.trim();
    if (group.trim()) body.group = group.trim();
    if (ga4PropertyId.trim()) body.ga4PropertyId = ga4PropertyId.trim();
    if (drupalDomain.trim()) body.drupalDomain = drupalDomain.trim();
    if (image.trim()) body.image = image.trim();
    if (awardsShowcaseId.trim()) body.awardsShowcaseId = awardsShowcaseId.trim();
    if (ga4FilterFieldName.trim() && ga4FilterValue.trim()) {
      body.ga4Filter = {
        fieldName: ga4FilterFieldName.trim(),
        matchType: ga4FilterMatchType,
        value: ga4FilterValue.trim(),
      };
    }

    const res = await fetch("/api/admin/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setFeedback(b?.error || "Save failed");
      return;
    }
    setFeedback("Saved.");
    router.refresh();
  }

  async function onDelete() {
    if (!confirm(`Permanently delete publication "${brand.slug}"?`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/brands/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: brand.slug }),
    });
    setBusy(false);
    if (res.ok) router.replace("/admin/brands");
    else setFeedback("Delete failed");
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={onSave}
        className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-4"
      >
        <h2 className="font-medium">Profile</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Display name</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Website URL</span>
            <input
              type="url"
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-10 h-8 rounded border border-black/15 dark:border-white/15 bg-transparent"
                value={color || "#000000"}
                onChange={(e) => setColor(e.target.value)}
              />
              <input
                className="flex-1 border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#FF0000"
              />
            </div>
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
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Awards showcase ID</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
              value={awardsShowcaseId}
              onChange={(e) => setAwardsShowcaseId(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm col-span-2">
            <span className="opacity-70">Drupal domain</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
              value={drupalDomain}
              onChange={(e) => setDrupalDomain(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm col-span-2">
            <span className="opacity-70">Image (path or URL)</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
              value={image}
              onChange={(e) => setImage(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 text-sm border-t border-black/10 dark:border-white/10 pt-3">
          <span className="opacity-70 text-xs uppercase tracking-wide">
            GA4 filter (only when this publication shares a property)
          </span>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Field</span>
              <input
                className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
                value={ga4FilterFieldName}
                onChange={(e) => setGa4FilterFieldName(e.target.value)}
                placeholder="hostName"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Match</span>
              <select
                className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
                value={ga4FilterMatchType}
                onChange={(e) => setGa4FilterMatchType(e.target.value)}
              >
                {FILTER_MATCH_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Value</span>
              <input
                className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
                value={ga4FilterValue}
                onChange={(e) => setGa4FilterValue(e.target.value)}
                placeholder="example.com"
              />
            </label>
          </div>
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
                <span className="text-sm">{humanize(d)}</span>
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

        <button
          type="submit"
          disabled={busy}
          className="self-start rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {feedback && <p className="text-xs opacity-70">{feedback}</p>}
      </form>

      <section className="border border-red-500/20 rounded-lg p-4 flex flex-col gap-3">
        <h2 className="font-medium text-red-500">Danger zone</h2>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="self-start text-xs px-3 py-1.5 rounded border border-red-500/40 hover:bg-red-500/10 disabled:opacity-50"
        >
          Delete this publication
        </button>
      </section>
    </div>
  );
}
