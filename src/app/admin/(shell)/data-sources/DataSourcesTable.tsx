"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import RemoveButton from "../_widgets/RemoveButton";

export type ClientDataSource = {
  kind: string;
  displayName: string;
  credentialRef: string;
};

export default function DataSourcesTable({
  rows,
}: {
  rows: ClientDataSource[];
}) {
  return (
    <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-black/5 dark:bg-white/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Kind</th>
            <th className="px-3 py-2 font-medium">Display name</th>
            <th className="px-3 py-2 font-medium">Credential env</th>
            <th className="px-3 py-2 font-medium w-40 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center opacity-60">
                No data sources yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <Row key={r.kind} row={r} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Row({ row }: { row: ClientDataSource }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(row.displayName);
  const [credentialRef, setCredentialRef] = useState(row.credentialRef);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDisplayName(row.displayName);
    setCredentialRef(row.credentialRef);
    setError(null);
    setEditing(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/data-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: row.kind,
        displayName: displayName.trim() || row.kind,
        credentialRef: credentialRef.trim(),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error || "Save failed");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <tr className="border-t border-black/10 dark:border-white/10 align-top">
      <td className="px-3 py-2 font-mono text-xs">{row.kind}</td>
      <td className="px-3 py-2">
        {editing ? (
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent w-full"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={busy}
          />
        ) : (
          row.displayName
        )}
      </td>
      <td className="px-3 py-2 font-mono text-xs">
        {editing ? (
          <input
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono w-full"
            value={credentialRef}
            onChange={(e) => setCredentialRef(e.target.value)}
            disabled={busy}
            placeholder="ENV_VAR_NAME"
          />
        ) : (
          row.credentialRef
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end items-center gap-2">
          {editing ? (
            <>
              {error && (
                <span className="text-xs text-red-500 mr-1">{error}</span>
              )}
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="rounded bg-foreground text-background px-2.5 py-1 text-xs font-medium disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="rounded border border-black/15 dark:border-white/15 px-2.5 py-1 text-xs disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded border border-black/15 dark:border-white/15 px-2.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
              >
                Edit
              </button>
              <RemoveButton entity="data-sources" payload={{ kind: row.kind }} />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
