"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import BirthdayEditor from "./BirthdayEditor";

export type ClientBirthday = {
  id: string;
  displayName: string;
  birthMonth: number;
  birthDay: number;
  mediaKind: "image" | "video";
  mediaPath: string;
  active: boolean;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function BirthdaysManager({
  birthdays,
}: {
  birthdays: ClientBirthday[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onDelete(b: ClientBirthday) {
    if (!confirm(`Delete birthday entry for "${b.displayName}"?`)) return;
    setBusyId(b.id);
    const res = await fetch("/api/admin/birthdays/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id }),
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else alert("Delete failed");
  }

  async function onToggleActive(b: ClientBirthday) {
    setBusyId(b.id);
    const next: ClientBirthday = { ...b, active: !b.active };
    const res = await fetch("/api/admin/birthdays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else alert("Update failed");
  }

  return (
    <div className="flex flex-col gap-4">
      {showAdd && (
        <BirthdayEditor
          mode="create"
          onSaved={() => {
            setShowAdd(false);
            router.refresh();
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Preview</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Birthday</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {birthdays.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center opacity-60">
                  No birthdays yet.
                </td>
              </tr>
            )}
            {birthdays.map((b) =>
              editingId === b.id ? (
                <tr key={b.id} className="border-t border-black/10 dark:border-white/10">
                  <td colSpan={6} className="p-3">
                    <BirthdayEditor
                      mode="edit"
                      initial={b}
                      onSaved={() => {
                        setEditingId(null);
                        router.refresh();
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              ) : (
                <tr
                  key={b.id}
                  className="border-t border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <td className="px-3 py-2">
                    {b.mediaKind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.mediaPath}
                        alt={b.displayName}
                        className="h-12 w-12 object-cover rounded"
                      />
                    ) : (
                      <video
                        src={b.mediaPath}
                        className="h-12 w-12 object-cover rounded bg-black"
                        muted
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">{b.displayName}</td>
                  <td className="px-3 py-2 text-xs opacity-80">
                    {MONTHS[b.birthMonth - 1]} {b.birthDay}
                  </td>
                  <td className="px-3 py-2 text-xs opacity-70">{b.mediaKind}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => onToggleActive(b)}
                      className={`px-2 py-0.5 text-xs rounded border ${
                        b.active
                          ? "bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-300"
                          : "bg-black/5 border-black/20 dark:bg-white/5 dark:border-white/20 opacity-60"
                      }`}
                    >
                      {b.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingId(b.id)}
                      className="text-xs underline-offset-2 hover:underline mr-3"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => onDelete(b)}
                      className="text-xs text-red-600 hover:underline underline-offset-2"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>

      {!showAdd && (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="self-start rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90"
        >
          + Add birthday
        </button>
      )}
    </div>
  );
}
