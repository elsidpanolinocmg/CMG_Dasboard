"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { humanize } from "@/lib/util/format";
import Hint from "../_widgets/Hint";

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
  departments: {
    departmentSlug: string;
    role: string;
    since: string | Date;
    properties?: Record<string, string>;
  }[];
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

  const [synonymInput, setSynonymInput] = useState("");
  const [synonyms, setSynonyms] = useState<string[]>(person.nameKeys);

  const [newDept, setNewDept] = useState("");
  const [newRole, setNewRole] = useState<string>("");
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
        ...synonyms,
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
        className="flex flex-col gap-3 border border-black/10 dark:border-white/10 rounded-2xl p-6 bg-black/[0.015] dark:bg-white/[0.02]"
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
          className="self-start rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>

      <section className="flex flex-col gap-3 border border-black/10 dark:border-white/10 rounded-2xl p-6 bg-black/[0.015] dark:bg-white/[0.02]">
        <h2 className="font-medium">
          Synonyms
          <Hint>
            Alternate names that should resolve to this person on leaderboards.
            Each synonym must be unique across all people. Username, display name
            and email are auto-included on profile save.
          </Hint>
        </h2>
        <div className="flex flex-wrap gap-2">
          {synonyms.length === 0 && (
            <span className="text-xs opacity-60">No synonyms.</span>
          )}
          {synonyms.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-black/5 dark:bg-white/5 font-mono"
            >
              {k}
              <button
                type="button"
                onClick={() => setSynonyms((prev) => prev.filter((x) => x !== k))}
                className="ml-1 opacity-60 hover:opacity-100"
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1 text-sm flex-1 min-w-[16rem]">
            <span className="opacity-70 text-xs">Add synonym (free text — will be normalized)</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
              value={synonymInput}
              onChange={(e) => setSynonymInput(e.target.value)}
              placeholder="e.g. Sam Bernardo"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const k = normalizeKey(synonymInput);
                  if (k && !synonyms.includes(k)) {
                    setSynonyms((prev) => [...prev, k]);
                    setSynonymInput("");
                  }
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const k = normalizeKey(synonymInput);
              if (k && !synonyms.includes(k)) {
                setSynonyms((prev) => [...prev, k]);
                setSynonymInput("");
              }
            }}
            className="rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 px-4 py-2 text-sm"
          >
            Add
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await fetch("/api/admin/people/name-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: person.username, nameKeys: synonyms }),
              });
              setBusy(false);
              if (res.ok) {
                const body = await res.json();
                setSynonyms(body.nameKeys ?? synonyms);
                setFeedback("Synonyms saved.");
                router.refresh();
              } else {
                const body = await res.json().catch(() => ({}));
                setFeedback(body?.error || "Save failed");
              }
            }}
            className="rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            Save synonyms
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 border border-black/10 dark:border-white/10 rounded-2xl p-6 bg-black/[0.015] dark:bg-white/[0.02]">
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
              <span className="font-mono">{humanize(d.departmentSlug)}</span>
              <span className="opacity-50">·</span>
              <span>{humanize(d.role)}</span>
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

        {person.departments.map((d) => (
          <DepartmentPropertiesEditor
            key={`props-${d.departmentSlug}`}
            username={person.username}
            departmentSlug={d.departmentSlug}
            initial={d.properties ?? {}}
            onSaved={(msg) => {
              setFeedback(msg);
              router.refresh();
            }}
          />
        ))}

        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70 text-xs">Add or update</span>
            <select
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
            >
              <option value="">(none)</option>
              {departmentSlugs.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
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
              <option value="">(none)</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!newDept || !newRole || busy}
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
            className="rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 border border-black/10 dark:border-white/10 rounded-2xl p-6 bg-black/[0.015] dark:bg-white/[0.02]">
        <h2 className="font-medium">
          Password
          <Hint>
            {person.canLogin
              ? "Login enabled. Set a new password to reset."
              : "No password set. Setting one enables login."}
          </Hint>
        </h2>
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
            className="rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            Save password
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 border border-red-500/30 rounded-2xl p-6 bg-red-500/[0.04]">
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

function DepartmentPropertiesEditor({
  username,
  departmentSlug,
  initial,
  onSaved,
}: {
  username: string;
  departmentSlug: string;
  initial: Record<string, string>;
  onSaved: (msg: string) => void;
}) {
  const [rows, setRows] = useState<{ k: string; v: string }[]>(() => {
    const entries = Object.entries(initial);
    return entries.length > 0 ? entries.map(([k, v]) => ({ k, v })) : [];
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const properties: Record<string, string> = {};
    for (const r of rows) {
      const k = r.k.trim();
      if (!k) continue;
      properties[k] = r.v;
    }
    const res = await fetch("/api/admin/people/department/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, departmentSlug, properties }),
    });
    setBusy(false);
    if (res.ok) {
      onSaved(`${humanize(departmentSlug)} properties saved.`);
    } else {
      const body = await res.json().catch(() => ({}));
      onSaved(body?.error || "Save failed");
    }
  }

  return (
    <div className="border-t border-black/10 dark:border-white/10 pt-3 mt-1">
      <div className="text-xs opacity-70 mb-2">
        <span className="font-mono">{humanize(departmentSlug)}</span> properties
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.length === 0 && (
          <span className="text-xs opacity-60">No properties.</span>
        )}
        {rows.map((row, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent text-sm font-mono w-40"
              value={row.k}
              placeholder="key"
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r, i) => (i === idx ? { ...r, k: e.target.value } : r)),
                )
              }
            />
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent text-sm flex-1"
              value={row.v}
              placeholder="value"
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r, i) => (i === idx ? { ...r, v: e.target.value } : r)),
                )
              }
            />
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
              className="opacity-60 hover:opacity-100 text-sm px-2"
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { k: "", v: "" }])}
          className="rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 px-3 py-1.5 text-xs"
        >
          + Add property
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-lg bg-foreground text-background px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save properties"}
        </button>
      </div>
    </div>
  );
}
