"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
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
    router.push(`/admin/people/${encodeURIComponent(created)}`);
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
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center opacity-60">
                  No people yet.
                </td>
              </tr>
            )}
            {people.map((p) => (
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
