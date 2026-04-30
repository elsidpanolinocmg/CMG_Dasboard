"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import RemoveButton from "../_widgets/RemoveButton";
import { PAGE_SCHEMAS, type FieldDef } from "./schemas";

export type ClientPageSetting = {
  pageKey: string;
  label: string;
  settings: Record<string, unknown>;
  saved: boolean;
  hasSchema: boolean;
};

export default function PageSettingsTable({
  rows,
}: {
  rows: ClientPageSetting[];
}) {
  return (
    <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-black/5 dark:bg-white/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium w-56">Page</th>
            <th className="px-3 py-2 font-medium">Settings</th>
            <th className="px-3 py-2 font-medium w-44 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center opacity-60">
                No pages registered.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <Row key={r.pageKey} row={r} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function defaultsFor(fields: FieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if ("defaultValue" in f && f.defaultValue !== undefined) {
      out[f.key] = f.defaultValue;
    }
  }
  return out;
}

function mergeWithDefaults(
  fields: FieldDef[],
  saved: Record<string, unknown>,
): Record<string, unknown> {
  return { ...defaultsFor(fields), ...saved };
}

function Row({ row }: { row: ClientPageSetting }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schema = PAGE_SCHEMAS[row.pageKey];

  const initialValues = schema
    ? mergeWithDefaults(schema.fields, row.settings)
    : row.settings;
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [jsonText, setJsonText] = useState(JSON.stringify(row.settings, null, 2));

  function startEdit() {
    setValues(
      schema ? mergeWithDefaults(schema.fields, row.settings) : row.settings,
    );
    setJsonText(JSON.stringify(row.settings, null, 2));
    setError(null);
    setEditing(true);
  }

  async function save() {
    let payload: Record<string, unknown>;
    if (schema) {
      payload = {};
      for (const f of schema.fields) {
        const v = values[f.key];
        if (v === "" || v === undefined || v === null) continue;
        payload[f.key] = v;
      }
    } else {
      try {
        const obj = JSON.parse(jsonText);
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
          setError("Settings must be a JSON object");
          return;
        }
        payload = obj as Record<string, unknown>;
      } catch {
        setError("Settings must be valid JSON");
        return;
      }
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/page-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageKey: row.pageKey,
        label: row.label,
        settings: payload,
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
      <td className="px-3 py-2 max-w-[14rem]">
        <div className="font-medium leading-tight">{row.label}</div>
        {!row.saved && (
          <div className="text-[11px] opacity-50 italic mt-0.5">unsaved</div>
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        {editing ? (
          schema ? (
            <SchemaForm
              fields={schema.fields}
              values={values}
              onChange={setValues}
              busy={busy}
            />
          ) : (
            <textarea
              rows={6}
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs w-full max-w-xl"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              disabled={busy}
            />
          )
        ) : (
          <SettingsSummary
            schema={schema}
            settings={row.settings}
          />
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end items-center gap-2 flex-wrap">
          {editing ? (
            <>
              {error && <span className="text-xs text-red-500 mr-1">{error}</span>}
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
              <button
                type="button"
                onClick={startEdit}
                className="rounded border border-black/15 dark:border-white/15 px-2.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
              >
                Edit
              </button>
              {row.saved && (
                <RemoveButton
                  entity="page-settings"
                  payload={{ pageKey: row.pageKey }}
                />
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function SettingsSummary({
  schema,
  settings,
}: {
  schema: { fields: FieldDef[] } | undefined;
  settings: Record<string, unknown>;
}) {
  const keys = Object.keys(settings);
  if (keys.length === 0) {
    return <span className="opacity-60 italic">defaults</span>;
  }
  if (!schema) {
    return (
      <pre className="font-mono text-[11px] opacity-70 whitespace-pre-wrap max-w-xl">
        {JSON.stringify(settings, null, 2)}
      </pre>
    );
  }
  const labelByKey = new Map(schema.fields.map((f) => [f.key, f.label]));
  return (
    <div className="flex flex-col gap-0.5">
      {Object.entries(settings).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="opacity-60">{labelByKey.get(k) ?? k}:</span>
          <span className="font-mono">
            {typeof v === "boolean" ? (v ? "yes" : "no") : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SchemaForm({
  fields,
  values,
  onChange,
  busy,
}: {
  fields: FieldDef[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  busy: boolean;
}) {
  function setField(key: string, v: unknown) {
    onChange({ ...values, [key]: v });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <label className="text-xs flex items-center gap-2">
            {f.type === "boolean" ? (
              <>
                <input
                  type="checkbox"
                  checked={!!values[f.key]}
                  disabled={busy}
                  onChange={(e) => setField(f.key, e.target.checked)}
                />
                <span>{f.label}</span>
              </>
            ) : (
              <span className="opacity-70">
                {f.label}
                {"unit" in f && f.unit ? (
                  <span className="opacity-50"> ({f.unit})</span>
                ) : null}
              </span>
            )}
          </label>
          {f.type === "number" && (
            <input
              type="number"
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent text-xs"
              value={values[f.key] === undefined ? "" : String(values[f.key])}
              min={f.min}
              max={f.max}
              step={f.step}
              disabled={busy}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") return setField(f.key, undefined);
                const n = Number(raw);
                setField(f.key, Number.isFinite(n) ? n : raw);
              }}
            />
          )}
          {f.type === "string" && (
            <input
              type="text"
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent text-xs"
              value={(values[f.key] as string) ?? ""}
              disabled={busy}
              onChange={(e) => setField(f.key, e.target.value)}
            />
          )}
          {f.type === "select" && (
            <select
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent text-xs"
              value={(values[f.key] as string) ?? ""}
              disabled={busy}
              onChange={(e) => setField(f.key, e.target.value)}
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {f.help && (
            <span className="text-[11px] opacity-50 leading-tight">{f.help}</span>
          )}
        </div>
      ))}
    </div>
  );
}
