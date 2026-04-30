"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { humanize } from "@/lib/util/format";
import ToggleCheckbox from "../_widgets/ToggleCheckbox";

type ClientPerson = {
  username: string;
  displayName: string;
  email: string;
  active: boolean;
  nameKeys: string[];
  departments: { departmentSlug: string; role: string; since: string | Date }[];
  canLogin: boolean;
  lastLoginAt: string | null;
};

type SortKey = "username" | "displayName" | "email" | "active" | "departments";
type SortDir = "asc" | "desc";

function normalizeKey(raw: string): string {
  if (!raw) return "";
  const lower = raw.trim().toLowerCase();
  const local = lower.includes("@") ? lower.split("@")[0] : lower;
  return local.replace(/[\s._-]+/g, "");
}

export default function PeopleManager({ people }: { people: ClientPerson[] }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [loginFilter, setLoginFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [sortKey, setSortKey] = useState<SortKey>("username");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) for (const d of p.departments) set.add(d.departmentSlug);
    return Array.from(set).sort();
  }, [people]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      if (q) {
        const hay = `${p.username} ${p.displayName} ${p.email} ${p.nameKeys.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (deptFilter) {
        if (deptFilter === "__none__") {
          if (p.departments.length > 0) return false;
        } else if (!p.departments.some((d) => d.departmentSlug === deptFilter)) {
          return false;
        }
      }
      if (activeFilter === "active" && !p.active) return false;
      if (activeFilter === "inactive" && p.active) return false;
      if (loginFilter === "enabled" && !p.canLogin) return false;
      if (loginFilter === "disabled" && p.canLogin) return false;
      return true;
    });
  }, [people, search, deptFilter, activeFilter, loginFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const cmp = (a: ClientPerson, b: ClientPerson): number => {
      switch (sortKey) {
        case "username":
          return a.username.localeCompare(b.username);
        case "displayName":
          return a.displayName.localeCompare(b.displayName);
        case "email":
          return (a.email || "").localeCompare(b.email || "");
        case "active":
          return Number(b.active) - Number(a.active);
        case "departments":
          return a.departments.length - b.departments.length;
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

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const nameKeys = Array.from(
      new Set([
        normalizeKey(username),
        normalizeKey(displayName),
        normalizeKey(email),
      ].filter(Boolean)),
    );
    const body = {
      username: username.trim(),
      displayName: displayName.trim() || username.trim(),
      email: email.trim() || undefined,
      active,
      nameKeys,
      departments: [],
    };
    const res = await fetch("/api/admin/people", {
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
    const created = username.trim();
    setUsername("");
    setDisplayName("");
    setEmail("");
    setActive(true);
    setShowAdd(false);
    router.push(`/admin/people/${encodeURIComponent(created)}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-end text-sm">
        <label className="flex flex-col gap-1 flex-1 min-w-[14rem]">
          <span className="opacity-70 text-xs">Search</span>
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            placeholder="username, display name, email, synonym…"
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
            {allDepartments.map((d) => (
              <option key={d} value={d}>
                {humanize(d)}
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
        <label className="flex flex-col gap-1">
          <span className="opacity-70 text-xs">Login</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={loginFilter}
            onChange={(e) => setLoginFilter(e.target.value as typeof loginFilter)}
          >
            <option value="all">All</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <span className="ml-auto text-xs opacity-60">
          {sorted.length} / {people.length}
        </span>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th
                className="px-3 py-2 font-medium cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => toggleSort("username")}
              >
                Username{sortIndicator("username")}
              </th>
              <th
                className="px-3 py-2 font-medium cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => toggleSort("displayName")}
              >
                Display name{sortIndicator("displayName")}
              </th>
              <th
                className="px-3 py-2 font-medium cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => toggleSort("email")}
              >
                Email{sortIndicator("email")}
              </th>
              <th
                className="px-3 py-2 font-medium cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => toggleSort("active")}
              >
                Active{sortIndicator("active")}
              </th>
              <th className="px-3 py-2 font-medium">Login</th>
              <th
                className="px-3 py-2 font-medium cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => toggleSort("departments")}
              >
                Departments{sortIndicator("departments")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center opacity-60">
                  {people.length === 0 ? "No people yet." : "No matches."}
                </td>
              </tr>
            )}
            {sorted.map((p) => (
              <tr
                key={p.username}
                className="border-t border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                onClick={() =>
                  router.push(`/admin/people/${encodeURIComponent(p.username)}`)
                }
              >
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    href={`/admin/people/${encodeURIComponent(p.username)}`}
                    className="underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {p.username}
                  </Link>
                </td>
                <td className="px-3 py-2">{p.displayName}</td>
                <td className="px-3 py-2 text-xs opacity-70">{p.email || ""}</td>
                <td className="px-3 py-2">
                  <ToggleCheckbox
                    entity="people"
                    field="active"
                    identifier={{ username: p.username }}
                    initial={p.active}
                    title="Toggle active"
                  />
                </td>
                <td className="px-3 py-2 text-xs opacity-70">
                  {p.canLogin ? "enabled" : ""}
                </td>
                <td className="px-3 py-2 text-xs">
                  {p.departments.length === 0
                    ? null
                    : p.departments.map((d) => (
                        <span
                          key={d.departmentSlug}
                          className="inline-block mr-1 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[11px]"
                        >
                          <span>{humanize(d.departmentSlug)}</span>
                          <span className="opacity-50"> · </span>
                          <span>{humanize(d.role)}</span>
                        </span>
                      ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {!showAdd && (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="self-start rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90"
        >
          + Add person
        </button>
      )}
      {showAdd && (
      <form
        onSubmit={onCreate}
        className="border border-black/10 dark:border-white/10 rounded-2xl p-6 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col gap-3"
      >
        <h2 className="font-medium">Add person</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Username</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Display name</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm col-span-2">
            <span className="opacity-70">Email</span>
            <input
              type="email"
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAdd(false);
              setError(null);
            }}
            className="text-sm opacity-70 hover:opacity-100"
          >
            Cancel
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
