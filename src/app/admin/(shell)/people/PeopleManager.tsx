"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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

const ROLES = [
  "managing_editor",
  "editor",
  "reporter",
  "admin",
  "viewer",
] as const;

function normalizeKey(raw: string): string {
  if (!raw) return "";
  const lower = raw.trim().toLowerCase();
  const local = lower.includes("@") ? lower.split("@")[0] : lower;
  return local.replace(/[\s._-]+/g, "");
}

export default function PeopleManager({
  people,
  departmentSlugs,
}: {
  people: ClientPerson[];
  departmentSlugs: string[];
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const nameKeys = Array.from(
      new Set(
        [normalizeKey(username), normalizeKey(displayName), normalizeKey(email)].filter(
          Boolean,
        ),
      ),
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
    setUsername("");
    setDisplayName("");
    setEmail("");
    setActive(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Username</th>
              <th className="px-3 py-2 font-medium">Display name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2 font-medium">Login</th>
              <th className="px-3 py-2 font-medium">Departments</th>
              <th className="px-3 py-2 font-medium w-32"></th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center opacity-60">
                  No people yet.
                </td>
              </tr>
            )}
            {people.map((p) => (
              <PersonRow
                key={p.username}
                person={p}
                departmentSlugs={departmentSlugs}
              />
            ))}
          </tbody>
        </table>
      </section>

      <form
        onSubmit={onCreate}
        className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3"
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
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add"}
        </button>
      </form>
    </div>
  );
}

function PersonRow({
  person: p,
  departmentSlugs,
}: {
  person: ClientPerson;
  departmentSlugs: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newDept, setNewDept] = useState(departmentSlugs[0] ?? "");
  const [newRole, setNewRole] = useState<string>(ROLES[1]);
  const [pwd, setPwd] = useState("");

  async function call(path: string, payload: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) router.refresh();
  }

  return (
    <>
      <tr className="border-t border-black/10 dark:border-white/10">
        <td className="px-3 py-2 font-mono text-xs">{p.username}</td>
        <td className="px-3 py-2">{p.displayName}</td>
        <td className="px-3 py-2 text-xs opacity-70">{p.email || "—"}</td>
        <td className="px-3 py-2">{p.active ? "yes" : "no"}</td>
        <td className="px-3 py-2">{p.canLogin ? "yes" : "—"}</td>
        <td className="px-3 py-2 text-xs">
          {p.departments.length === 0
            ? "—"
            : p.departments
                .map((d) => `${d.departmentSlug}:${d.role}`)
                .join(", ")}
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs px-2 py-1 rounded border border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5"
          >
            {open ? "Close" : "Manage"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-black/10 dark:border-white/10 bg-black/2 dark:bg-white/2">
          <td colSpan={7} className="px-3 py-3">
            <div className="flex flex-col gap-4 text-sm">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="font-medium">Departments:</span>
                {p.departments.length === 0 && (
                  <span className="opacity-60">none</span>
                )}
                {p.departments.map((d) => (
                  <span
                    key={d.departmentSlug}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-black/5 dark:bg-white/5"
                  >
                    <span className="font-mono">{d.departmentSlug}</span>
                    <span className="opacity-50">·</span>
                    <span>{d.role}</span>
                    <button
                      type="button"
                      onClick={() =>
                        call("/api/admin/people/department/remove", {
                          username: p.username,
                          departmentSlug: d.departmentSlug,
                        })
                      }
                      className="ml-1 opacity-60 hover:opacity-100"
                      title="Remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 items-end">
                <label className="flex flex-col gap-1">
                  <span className="opacity-70 text-xs">Department</span>
                  <select
                    className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                  >
                    {departmentSlugs.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="opacity-70 text-xs">Role</span>
                  <select
                    className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!newDept}
                  onClick={() =>
                    call("/api/admin/people/department/add", {
                      username: p.username,
                      departmentSlug: newDept,
                      role: newRole,
                    })
                  }
                  className="rounded bg-foreground text-background px-3 py-1 text-xs font-medium disabled:opacity-50"
                >
                  Add / update
                </button>
              </div>

              <div className="flex flex-wrap gap-2 items-end">
                <label className="flex flex-col gap-1">
                  <span className="opacity-70 text-xs">
                    {p.canLogin ? "Reset password" : "Set password (enables login)"}
                  </span>
                  <input
                    type="password"
                    className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent w-64"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>
                <button
                  type="button"
                  disabled={pwd.length < 6}
                  onClick={() => {
                    call("/api/admin/people/password", {
                      username: p.username,
                      password: pwd,
                    });
                    setPwd("");
                  }}
                  className="rounded bg-foreground text-background px-3 py-1 text-xs font-medium disabled:opacity-50"
                >
                  Save password
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    call("/api/admin/people", {
                      username: p.username,
                      displayName: p.displayName,
                      email: p.email || undefined,
                      active: !p.active,
                      nameKeys: p.nameKeys,
                      departments: p.departments,
                    })
                  }
                  className="text-xs px-2 py-1 rounded border border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Toggle active
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Remove ${p.username}?`)) return;
                    call("/api/admin/people/delete", { username: p.username });
                  }}
                  className="text-xs px-2 py-1 rounded border border-black/15 dark:border-white/15 hover:bg-red-500/10 hover:border-red-500/40"
                >
                  Delete person
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
