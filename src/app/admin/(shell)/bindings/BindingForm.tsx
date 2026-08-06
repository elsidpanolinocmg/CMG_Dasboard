"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/**
 * `ceo_*` purposes belong to the CEO dashboards, which are not a department;
 * they are stored under the reserved scope slug `ceo`.
 */
const PURPOSES = [
  { value: "leaderboard", label: "leaderboard" },
  { value: "sponsorship", label: "sponsorship" },
  { value: "analytics", label: "analytics" },
  { value: "content", label: "content" },
  { value: "media", label: "media" },
  { value: "ceo_money", label: "CEO · Money sheet" },
  { value: "ceo_invoice_register", label: "CEO · Invoice register" },
  { value: "ceo_marketing", label: "CEO · Marketing sheet" },
] as const;

type Purpose = (typeof PURPOSES)[number]["value"];

const CEO_SCOPE = "ceo";

function isCeoPurpose(p: Purpose): boolean {
  return p.startsWith("ceo_");
}

export default function BindingForm({
  departmentSlugs,
  sourceKinds,
}: {
  departmentSlugs: string[];
  sourceKinds: string[];
}) {
  const router = useRouter();
  const [departmentSlug, setDepartmentSlug] = useState(departmentSlugs[0] ?? "");
  const [purpose, setPurpose] = useState<Purpose>("leaderboard");
  const [dataSourceKind, setDataSourceKind] = useState(
    sourceKinds.includes("google_sheets") ? "google_sheets" : (sourceKinds[0] ?? ""),
  );
  const [sheetsCfg, setSheetsCfg] = useState({
    spreadsheetId: "",
    gid: "",
    sheetName: "",
    range: "",
  });
  const [configText, setConfigText] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ceo = isCeoPurpose(purpose);
  const effectiveSlug = ceo ? CEO_SCOPE : departmentSlug;
  const friendlySheets = dataSourceKind === "google_sheets";

  function onPurposeChange(next: Purpose) {
    setPurpose(next);
    // CEO purposes are always Google Sheets today; preselect it if available.
    if (isCeoPurpose(next) && sourceKinds.includes("google_sheets")) {
      setDataSourceKind("google_sheets");
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!effectiveSlug || !dataSourceKind) return;

    let config: unknown;
    if (friendlySheets) {
      const spreadsheetId = sheetsCfg.spreadsheetId.trim();
      if (!spreadsheetId) {
        setError("Spreadsheet ID is required");
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
      config = {
        spreadsheetId,
        ...(gid != null ? { gid } : {}),
        ...(sheetsCfg.sheetName.trim() ? { sheetName: sheetsCfg.sheetName.trim() } : {}),
        ...(sheetsCfg.range.trim() ? { range: sheetsCfg.range.trim() } : {}),
      };
    } else {
      try {
        config = JSON.parse(configText);
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
        departmentSlug: effectiveSlug,
        purpose,
        dataSourceKind,
        config,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.error || "Save failed");
      return;
    }
    setSheetsCfg({ spreadsheetId: "", gid: "", sheetName: "", range: "" });
    setConfigText("{}");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3"
    >
      <h2 className="font-medium">Add or update</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Purpose</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={purpose}
            onChange={(e) => onPurposeChange(e.target.value as Purpose)}
          >
            {PURPOSES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Department</span>
          {ceo ? (
            <select
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent opacity-70"
              value={CEO_SCOPE}
              disabled
            >
              <option value={CEO_SCOPE}>ceo (CEO dashboards)</option>
            </select>
          ) : (
            <select
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
              value={departmentSlug}
              onChange={(e) => setDepartmentSlug(e.target.value)}
              required
            >
              {departmentSlugs.length === 0 && <option value="">(none)</option>}
              {departmentSlugs.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Source kind</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={dataSourceKind}
            onChange={(e) => setDataSourceKind(e.target.value)}
            required
          >
            {sourceKinds.length === 0 && <option value="">(none)</option>}
            {sourceKinds.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {friendlySheets ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="opacity-70">
              Spreadsheet ID{" "}
              <span className="opacity-60">
                (the long code in the sheet&apos;s URL, between /d/ and /edit)
              </span>
            </span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
              value={sheetsCfg.spreadsheetId}
              onChange={(e) =>
                setSheetsCfg({ ...sheetsCfg, spreadsheetId: e.target.value })
              }
              placeholder="1AbC…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Tab name (optional)</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
              value={sheetsCfg.sheetName}
              onChange={(e) =>
                setSheetsCfg({ ...sheetsCfg, sheetName: e.target.value })
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">gid (optional)</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
              value={sheetsCfg.gid}
              onChange={(e) => setSheetsCfg({ ...sheetsCfg, gid: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="opacity-70">Range (optional)</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
              value={sheetsCfg.range}
              onChange={(e) =>
                setSheetsCfg({ ...sheetsCfg, range: e.target.value })
              }
              placeholder="A1:Z"
            />
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-70">Config (JSON)</span>
          <textarea
            rows={4}
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            placeholder='{"spreadsheetId":"...","sheetName":"..."}'
          />
        </label>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy || !effectiveSlug || !dataSourceKind}
        className="self-start rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
