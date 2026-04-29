"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const ROLES = [
  "managing_editor",
  "editor",
  "reporter",
  "admin",
  "viewer",
] as const;

export type ClientPerson = {
  username: string;
  displayName: string;
  email: string;
  active: boolean;
  nameKeys: string[];
  departments: { departmentSlug: string; role: string; since: string | Date }[];
  canLogin: boolean;
  lastLoginAt: string | null;
};

function normalizeKey(raw: string): string {
  if (!raw) return "";
  const lower = raw.trim().toLowerCase();
  const local = lower.includes("@") ? lower.split("@")[0] : lower;
  return local.replace(/[\s._-]+/g, "");
}

export default function PersonEditor({
  person,
  departmentSlugs,
}: {
  person: ClientPerson;
  departmentSlugs: string[];
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(person.displayName);
  const [email, setEmail] = useState(person.email);
  const [active, setActive] = useState(person.active);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [newDept, setNewDept] = useState(
    departmentSlugs.find((s) => !person.departments.some((d) => d.departmentSlug === s)) ??
      departmentSlugs[0] ??
      "",
  );
  const [newRole, setNewRole] = useState<string>(ROLES[1]);
  const [pwd, setPwd] = useState("");

  async function call(path: string, payload: unknown, message?: string) {
    setBusy(true);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setFeedback(message ?? "Saved.");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setFeedback(body?.error || "Save failed");
    }
  }

  async function onSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nameKeys = Array.from(
      new Set([
        ...person.nameKeys,
        normalizeKey(person.username),
        normalizeKey(displayName),
        normalizeKey(email),
      ].filter(Boolean)),
    );
    await call(
      "/api/admin/people",
      {
        username: person.username,
        displayName: displayName.trim(),
        email: email.trim() || undefined,
        active,
        nameKeys,
        departments: person.departments,
      },
      "Profile saved.",
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={onSaveProfile}
        className="flex flex-col gap-3 border border-black/10 dark:border-white/10 rounded-lg p-4"
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
        <div className="text-xs opacity-60">
          Login: {person.canLogin ? "enabled" : "disabled"}
          {person.lastLoginAt && ` · last login ${new Date(person.lastLoginAt).toLocaleString()}`}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>

      <section className="flex flex-col gap-3 border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium">Departments</h2>
        <div className="flex flex-wrap gap-2">
          {person.departments.length === 0 && (
            <span className="text-xs opacity-60">Not in any department.</span>
          )}
          {person.departments.map((d) => (
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
                  call(
                    "/api/admin/people/department/remove",
                    { username: person.username, departmentSlug: d.departmentSlug },
                    `Removed from ${d.departmentSlug}.`,
                  )
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70 text-xs">Add or update</span>
            <select
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
            >
              {departmentSlugs.length === 0 && <option value="">(none)</option>}
              {departmentSlugs.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
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
            disabled={!newDept || busy}
            onClick={() =>
              call(
                "/api/admin/people/department/add",
                {
                  username: person.username,
                  departmentSlug: newDept,
                  role: newRole,
                },
                `Set ${newDept} → ${newRole}.`,
              )
            }
            className="rounded bg-foreground text-background px-3 py-1 text-sm font-medium disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium">Password</h2>
        <p className="text-xs opacity-60">
          {person.canLogin
            ? "Login enabled. Set a new password to reset."
            : "No password set. Setting one enables login."}
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <input
            type="password"
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent w-72"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 6 characters"
          />
          <button
            type="button"
            disabled={pwd.length < 6 || busy}
            onClick={() => {
              call(
                "/api/admin/people/password",
                { username: person.username, password: pwd },
                "Password updated.",
              );
              setPwd("");
            }}
            className="rounded bg-foreground text-background px-3 py-1 text-sm font-medium disabled:opacity-50"
          >
            Save password
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 border border-red-500/20 rounded-lg p-4">
        <h2 className="font-medium text-red-500">Danger zone</h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!confirm(`Permanently delete ${person.username}?`)) return;
            (async () => {
              setBusy(true);
              const res = await fetch("/api/admin/people/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: person.username }),
              });
              setBusy(false);
              if (res.ok) router.replace("/admin/people");
              else setFeedback("Delete failed");
            })();
          }}
          className="self-start text-xs px-3 py-1.5 rounded border border-red-500/40 hover:bg-red-500/10 disabled:opacity-50"
        >
          Delete this person
        </button>
      </section>

      {feedback && <p className="text-xs opacity-70">{feedback}</p>}
    </div>
  );
}
