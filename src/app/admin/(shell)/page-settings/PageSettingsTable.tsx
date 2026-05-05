"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import RemoveButton from "../_widgets/RemoveButton";
import { PAGE_SCHEMAS, type FieldDef, type PageSchema } from "./schemas";

const ADVANCED_KEY = "advanced";

function advancedTextFromSettings(saved: Record<string, unknown>): string {
  const v = saved[ADVANCED_KEY];
  return v === undefined ? "" : JSON.stringify(v, null, 2);
}

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

function mergeWithDefaults(
  fields: FieldDef[],
  saved: Record<string, unknown>,
): Record<string, unknown> {
  // For json fields the form state stores text (so the user can mid-edit
  // partial JSON without losing it). Everything else stores the raw value.
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "json") {
      const v = f.key in saved ? saved[f.key] : f.defaultValue;
      out[f.key] = v === undefined ? "" : JSON.stringify(v, null, 2);
      continue;
    }
    if (f.key in saved) {
      out[f.key] = saved[f.key];
    } else if ("defaultValue" in f && f.defaultValue !== undefined) {
      out[f.key] = f.defaultValue;
    }
  }
  return out;
}

function Row({ row }: { row: ClientPageSetting }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const schema = PAGE_SCHEMAS[row.pageKey];

  const initialValues = schema
    ? mergeWithDefaults(schema.fields, row.settings)
    : row.settings;
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [jsonText, setJsonText] = useState(JSON.stringify(row.settings, null, 2));
  const [advancedText, setAdvancedText] = useState(() =>
    advancedTextFromSettings(row.settings),
  );
  // Tracks whether we've auto-seeded the example for this edit session, so a
  // user who deletes the example and closes/reopens doesn't get it re-seeded.
  const advancedSeededRef = useRef(false);

  function startEdit() {
    setValues(
      schema ? mergeWithDefaults(schema.fields, row.settings) : row.settings,
    );
    setJsonText(JSON.stringify(row.settings, null, 2));
    setAdvancedText(advancedTextFromSettings(row.settings));
    advancedSeededRef.current = false;
    setError(null);
    setEditing(true);
  }

  function toggleAdvanced() {
    // First time the disclosure opens during this edit session, if there's
    // no saved value and the schema has an example, seed the textarea so the
    // user can edit it directly instead of staring at a placeholder.
    if (
      !advancedOpen &&
      !advancedSeededRef.current &&
      advancedText === "" &&
      schema?.advancedExample !== undefined
    ) {
      setAdvancedText(JSON.stringify(schema.advancedExample, null, 2));
      advancedSeededRef.current = true;
    }
    setAdvancedOpen((v) => !v);
  }

  async function save() {
    let payload: Record<string, unknown>;
    if (schema) {
      payload = {};
      for (const f of schema.fields) {
        const v = values[f.key];
        if (v === "" || v === undefined || v === null) continue;
        if (f.type === "json") {
          if (typeof v !== "string") {
            payload[f.key] = v;
            continue;
          }
          try {
            payload[f.key] = JSON.parse(v);
          } catch {
            setError(`Invalid JSON in field "${f.label}"`);
            return;
          }
          continue;
        }
        payload[f.key] = v;
      }
      // Schema-backed pages get a universal "Advanced (JSON)" slot stored at
      // settings.advanced. Empty text → key omitted; explicit {} → key kept so
      // page-level fallbacks see the override.
      const advTrim = advancedText.trim();
      if (advTrim !== "") {
        try {
          const parsed = JSON.parse(advTrim);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            setError("Advanced must be a JSON object");
            return;
          }
          payload[ADVANCED_KEY] = parsed;
        } catch {
          setError("Advanced must be valid JSON");
          return;
        }
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
    setAdvancedOpen(false);
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
            <div className="flex flex-col gap-3">
              <SchemaForm
                fields={schema.fields}
                values={values}
                onChange={setValues}
                busy={busy}
              />
              <AdvancedDisclosure
                open={advancedOpen}
                onToggle={toggleAdvanced}
                hasValue={advancedText.trim() !== ""}
              >
                <textarea
                  rows={8}
                  spellCheck={false}
                  placeholder={advancedPlaceholder(schema)}
                  className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-[11px] w-full max-w-2xl"
                  value={advancedText}
                  onChange={(e) => setAdvancedText(e.target.value)}
                  disabled={busy}
                />
                <p className="text-[11px] opacity-50 leading-tight max-w-2xl mt-1">
                  Free-form JSON consumed by the page itself (filters, conditions,
                  etc.). Empty disables the override; <code>{"{}"}</code> clears any
                  page-level default.
                </p>
              </AdvancedDisclosure>
            </div>
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
          <SettingsSummary schema={schema} settings={row.settings} />
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
                  setAdvancedOpen(false);
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

function AdvancedDisclosure({
  open,
  onToggle,
  hasValue,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  hasValue: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-black/10 dark:border-white/10 pt-2 mt-1">
      <button
        type="button"
        onClick={onToggle}
        className="text-[11px] uppercase tracking-wider opacity-60 hover:opacity-100 flex items-center gap-1.5"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>Advanced</span>
        {hasValue && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/15 normal-case tracking-normal">
            override active
          </span>
        )}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function advancedPlaceholder(schema: PageSchema | undefined): string {
  if (schema?.advancedExample !== undefined) {
    return JSON.stringify(schema.advancedExample, null, 2);
  }
  return "{}";
}

function SettingsSummary({
  schema,
  settings,
}: {
  schema: { fields: FieldDef[] } | undefined;
  settings: Record<string, unknown>;
}) {
  // The "advanced" key is rendered by its own disclosure, not here.
  const visibleEntries = Object.entries(settings).filter(
    ([k]) => k !== ADVANCED_KEY,
  );
  if (visibleEntries.length === 0) {
    return <span className="opacity-60 italic">defaults</span>;
  }
  if (!schema) {
    const filtered = Object.fromEntries(visibleEntries);
    return (
      <pre className="font-mono text-[11px] opacity-70 whitespace-pre-wrap max-w-xl">
        {JSON.stringify(filtered, null, 2)}
      </pre>
    );
  }
  const fieldByKey = new Map(schema.fields.map((f) => [f.key, f]));
  return (
    <div className="flex flex-col gap-1">
      {visibleEntries.map(([k, v]) => {
        const f = fieldByKey.get(k);
        if (f?.type === "json") {
          return (
            <div key={k} className="flex flex-col gap-0.5">
              <span className="opacity-60">{f.label}:</span>
              <pre className="font-mono text-[11px] opacity-80 whitespace-pre-wrap max-w-2xl">
                {JSON.stringify(v, null, 2)}
              </pre>
            </div>
          );
        }
        return (
          <div key={k} className="flex gap-2">
            <span className="opacity-60">{f?.label ?? k}:</span>
            <span className="font-mono">
              {typeof v === "boolean" ? (v ? "yes" : "no") : String(v)}
            </span>
          </div>
        );
      })}
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
      {fields.map((f) => (
        <div
          key={f.key}
          className={`flex flex-col gap-1 ${f.type === "json" ? "md:col-span-2" : ""}`}
        >
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
          {f.type === "json" && (
            <textarea
              rows={8}
              spellCheck={false}
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-[11px] w-full"
              value={(values[f.key] as string) ?? ""}
              disabled={busy}
              onChange={(e) => setField(f.key, e.target.value)}
            />
          )}
          {f.help && (
            <span className="text-[11px] opacity-50 leading-tight">{f.help}</span>
          )}
        </div>
      ))}
    </div>
  );
}
