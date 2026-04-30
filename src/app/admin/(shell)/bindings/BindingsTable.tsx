"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import RemoveButton from "../_widgets/RemoveButton";
import TestBindingButton from "./TestBindingButton";

export type ClientBinding = {
  departmentSlug: string;
  purpose: string;
  dataSourceKind: string;
  config: Record<string, unknown>;
};

export default function BindingsTable({ rows }: { rows: ClientBinding[] }) {
  return (
    <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-black/5 dark:bg-white/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Department</th>
            <th className="px-3 py-2 font-medium">Purpose</th>
            <th className="px-3 py-2 font-medium">Source kind</th>
            <th className="px-3 py-2 font-medium">Config</th>
            <th className="px-3 py-2 font-medium w-56 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center opacity-60">
                No bindings yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <Row
              key={`${r.departmentSlug}/${r.purpose}/${r.dataSourceKind}`}
              row={r}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Row({ row }: { row: ClientBinding }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google Sheets: friendly fields.
  const initialSheets = {
    spreadsheetId: stringOrEmpty(row.config.spreadsheetId),
    gid: numberOrEmpty(row.config.gid),
    sheetName: stringOrEmpty(row.config.sheetName),
    range: stringOrEmpty(row.config.range),
  };
  const [sheetsCfg, setSheetsCfg] = useState(initialSheets);

  // Anything else: raw JSON.
  const [jsonText, setJsonText] = useState(JSON.stringify(row.config, null, 2));

  function startEdit() {
    setSheetsCfg(initialSheets);
    setJsonText(JSON.stringify(row.config, null, 2));
    setError(null);
    setEditing(true);
  }

  async function save() {
    let nextConfig: Record<string, unknown>;
    if (row.dataSourceKind === "google_sheets") {
      const spreadsheetId = sheetsCfg.spreadsheetId.trim();
      if (!spreadsheetId) {
        setError("spreadsheetId is required");
        return;
      }
      const gidStr = sheetsCfg.gid.trim();
      let gid: number | undefined;
      if (gidStr !== "") {
        const n = Number(gidStr);
        if (!Number.isFinite(n)) {
          setError("gid must be a number");
          return;
        }
        gid = n;
      }
      nextConfig = {
        spreadsheetId,
        ...(gid != null ? { gid } : {}),
        ...(sheetsCfg.sheetName.trim()
          ? { sheetName: sheetsCfg.sheetName.trim() }
          : {}),
        ...(sheetsCfg.range.trim() ? { range: sheetsCfg.range.trim() } : {}),
      };
    } else {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setError("Config must be a JSON object");
          return;
        }
        nextConfig = parsed as Record<string, unknown>;
      } catch {
        setError("Config must be valid JSON");
        return;
      }
    }

    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/bindings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentSlug: row.departmentSlug,
        purpose: row.purpose,
        dataSourceKind: row.dataSourceKind,
        config: nextConfig,
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
      <td className="px-3 py-2 font-mono text-xs">{row.departmentSlug}</td>
      <td className="px-3 py-2 font-mono text-xs">{row.purpose}</td>
      <td className="px-3 py-2 font-mono text-xs">{row.dataSourceKind}</td>
      <td className="px-3 py-2 text-xs">
        {editing ? (
          row.dataSourceKind === "google_sheets" ? (
            <div className="grid grid-cols-2 gap-2 max-w-xl">
              <label className="flex flex-col gap-0.5 col-span-2">
                <span className="opacity-60 text-[11px]">spreadsheetId</span>
                <input
                  className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
                  value={sheetsCfg.spreadsheetId}
                  onChange={(e) =>
                    setSheetsCfg({ ...sheetsCfg, spreadsheetId: e.target.value })
                  }
                  disabled={busy}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="opacity-60 text-[11px]">gid</span>
                <input
                  className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
                  value={sheetsCfg.gid}
                  onChange={(e) =>
                    setSheetsCfg({ ...sheetsCfg, gid: e.target.value })
                  }
                  placeholder="(optional)"
                  disabled={busy}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="opacity-60 text-[11px]">sheetName</span>
                <input
                  className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
                  value={sheetsCfg.sheetName}
                  onChange={(e) =>
                    setSheetsCfg({ ...sheetsCfg, sheetName: e.target.value })
                  }
                  placeholder="(optional, falls back to gid)"
                  disabled={busy}
                />
              </label>
              <label className="flex flex-col gap-0.5 col-span-2">
                <span className="opacity-60 text-[11px]">range</span>
                <input
                  className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
                  value={sheetsCfg.range}
                  onChange={(e) =>
                    setSheetsCfg({ ...sheetsCfg, range: e.target.value })
                  }
                  placeholder="A1:Z (optional)"
                  disabled={busy}
                />
              </label>
            </div>
          ) : (
            <textarea
              rows={5}
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs w-full max-w-xl"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              disabled={busy}
            />
          )
        ) : (
          <ConfigCell kind={row.dataSourceKind} config={row.config} />
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end items-center gap-2 flex-wrap">
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
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                disabled={busy}
                className="rounded border border-black/15 dark:border-white/15 px-2.5 py-1 text-xs disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <TestBindingButton
                departmentSlug={row.departmentSlug}
                purpose={row.purpose}
                dataSourceKind={row.dataSourceKind}
              />
              <button
                type="button"
                onClick={startEdit}
                className="rounded border border-black/15 dark:border-white/15 px-2.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
              >
                Edit
              </button>
              <RemoveButton
                entity="bindings"
                payload={{
                  departmentSlug: row.departmentSlug,
                  purpose: row.purpose,
                  dataSourceKind: row.dataSourceKind,
                }}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function ConfigCell({
  kind,
  config,
}: {
  kind: string;
  config: Record<string, unknown>;
}) {
  if (kind === "google_sheets") {
    const spreadsheetId = stringOrEmpty(config.spreadsheetId);
    const gid = typeof config.gid === "number" ? config.gid : null;
    const sheetName = stringOrEmpty(config.sheetName);
    const range = stringOrEmpty(config.range);
    if (spreadsheetId) {
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit${
        gid != null ? `#gid=${gid}` : ""
      }`;
      const label = sheetName || (gid != null ? `gid=${gid}` : "Open sheet");
      return (
        <div className="flex flex-col gap-0.5">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs underline-offset-2 hover:underline"
          >
            {label} ↗
          </a>
          <span className="font-mono text-[11px] opacity-50 truncate max-w-md">
            id: {spreadsheetId}
            {range ? ` · range: ${range}` : ""}
          </span>
        </div>
      );
    }
  }
  return (
    <span className="font-mono text-xs opacity-70 truncate max-w-md inline-block">
      {JSON.stringify(config)}
    </span>
  );
}

function stringOrEmpty(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function numberOrEmpty(v: unknown): string {
  return typeof v === "number" ? String(v) : "";
}
