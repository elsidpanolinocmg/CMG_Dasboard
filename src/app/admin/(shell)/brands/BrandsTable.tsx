"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { humanize } from "@/lib/util/format";
import ToggleCheckbox from "../_widgets/ToggleCheckbox";

export type ClientBrand = {
  slug: string;
  displayName: string;
  url?: string;
  color?: string;
  departments?: string[];
  group?: string;
  ga4PropertyId?: string;
  active: boolean;
};

type SortKey = "displayName" | "slug" | "group" | "departments" | "active";
type SortDir = "asc" | "desc";

export default function BrandsTable({ brands }: { brands: ClientBrand[] }) {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortKey, setSortKey] = useState<SortKey>("displayName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const allDepts = useMemo(() => {
    const set = new Set<string>();
    for (const b of brands) for (const d of b.departments ?? []) set.add(d);
    return Array.from(set).sort();
  }, [brands]);

  const allGroups = useMemo(() => {
    const set = new Set<string>();
    for (const b of brands) if (b.group) set.add(b.group);
    return Array.from(set).sort();
  }, [brands]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return brands.filter((b) => {
      if (q) {
        const hay = `${b.slug} ${b.displayName} ${b.url ?? ""} ${b.ga4PropertyId ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (deptFilter) {
        if (deptFilter === "__none__") {
          if ((b.departments ?? []).length > 0) return false;
        } else if (!(b.departments ?? []).includes(deptFilter)) {
          return false;
        }
      }
      if (groupFilter) {
        if (groupFilter === "__none__") {
          if (b.group) return false;
        } else if (b.group !== groupFilter) {
          return false;
        }
      }
      if (activeFilter === "active" && !b.active) return false;
      if (activeFilter === "inactive" && b.active) return false;
      return true;
    });
  }, [brands, search, deptFilter, groupFilter, activeFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const cmp = (a: ClientBrand, b: ClientBrand): number => {
      switch (sortKey) {
        case "displayName":
          return a.displayName.localeCompare(b.displayName);
        case "slug":
          return a.slug.localeCompare(b.slug);
        case "group":
          return (a.group ?? "").localeCompare(b.group ?? "");
        case "departments":
          return (a.departments?.length ?? 0) - (b.departments?.length ?? 0);
        case "active":
          return Number(b.active) - Number(a.active);
      }
    };
    copy.sort((a, b) => (sortDir === "asc" ? cmp(a, b) : -cmp(a, b)));
    return copy;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  const ind = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-end text-sm">
        <label className="flex flex-col gap-1 flex-1 min-w-[14rem]">
          <span className="opacity-70 text-xs">Search</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            placeholder="slug, name, URL, GA4 id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="opacity-70 text-xs">Department</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="">All</option>
            {allDepts.map((d) => (
              <option key={d} value={d}>
                {humanize(d)}
              </option>
            ))}
            <option value="__none__">— None —</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="opacity-70 text-xs">Group</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="">All</option>
            {allGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
            <option value="__none__">— None —</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="opacity-70 text-xs">Status</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <span className="ml-auto text-xs opacity-60">
          {sorted.length} / {brands.length}
        </span>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <Th onClick={() => toggleSort("displayName")} ind={ind("displayName")}>
                Display name
              </Th>
              <th className="px-3 py-2 font-medium">URL</th>
              <th className="px-3 py-2 font-medium">Color</th>
              <Th onClick={() => toggleSort("departments")} ind={ind("departments")}>
                Departments
              </Th>
              <Th onClick={() => toggleSort("group")} ind={ind("group")}>
                Group
              </Th>
              <th className="px-3 py-2 font-medium">GA4 property</th>
              <Th onClick={() => toggleSort("active")} ind={ind("active")}>
                Active
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center opacity-60">
                  {brands.length === 0 ? "No publications yet." : "No matches."}
                </td>
              </tr>
            )}
            {sorted.map((b) => (
              <tr
                key={b.slug}
                className="border-t border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/brands/${encodeURIComponent(b.slug)}`}
                    className="block underline-offset-2 hover:underline"
                  >
                    {b.displayName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs opacity-70 truncate max-w-[180px]">
                  {b.url ? (
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {b.url.replace(/^https?:\/\//, "")}
                    </a>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs">
                  {b.color ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block w-3 h-3 rounded-sm border border-black/10 dark:border-white/10"
                        style={{ backgroundColor: b.color }}
                      />
                      <span className="font-mono opacity-70">{b.color}</span>
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs">
                  {(b.departments ?? []).length === 0
                    ? null
                    : (b.departments ?? []).map((d) => (
                        <span
                          key={d}
                          className="inline-block mr-1 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[11px]"
                        >
                          {humanize(d)}
                        </span>
                      ))}
                </td>
                <td className="px-3 py-2 text-xs opacity-70">{b.group ?? ""}</td>
                <td className="px-3 py-2 font-mono text-xs opacity-70">
                  {b.ga4PropertyId ?? ""}
                </td>
                <td className="px-3 py-2">
                  <ToggleCheckbox
                    entity="brands"
                    field="active"
                    identifier={{ slug: b.slug }}
                    initial={b.active}
                    title="Toggle active"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({
  onClick,
  ind,
  children,
}: {
  onClick: () => void;
  ind: string;
  children: React.ReactNode;
}) {
  return (
    <th
      className="px-3 py-2 font-medium cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5"
      onClick={onClick}
    >
      {children}
      {ind}
    </th>
  );
}
