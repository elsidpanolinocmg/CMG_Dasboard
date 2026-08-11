"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useUnsavedWarning } from "../../_widgets/useUnsavedWarning";

type Attached = {
  people: number;
  publications: number;
  bindings: number;
  dashboards: number;
};

export default function DepartmentEditor(props: {
  slug: string;
  displayName: string;
  routePrefix: string;
  order: number;
  enabled: boolean;
  attached: Attached;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(props.displayName);
  const [routePrefix, setRoutePrefix] = useState(props.routePrefix);
  const [order, setOrder] = useState(props.order);
  const [enabled, setEnabled] = useState(props.enabled);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const dirty =
    displayName !== props.displayName ||
    routePrefix !== props.routePrefix ||
    Number(order) !== props.order ||
    enabled !== props.enabled;
  useUnsavedWarning(dirty && !busy);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    const res = await fetch("/api/admin/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: props.slug,
        displayName: displayName.trim(),
        routePrefix: routePrefix.trim() || `/dashboard/${props.slug}`,
        order: Number(order),
        enabled,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setFeedback(b?.error || "Save failed");
      return;
    }
    setFeedback("Saved.");
    router.refresh();
  }

  async function onDelete() {
    const { people, publications, bindings, dashboards } = props.attached;
    const effects = [
      people && `${people} ${people === 1 ? "person" : "people"} will lose this department`,
      publications &&
        `${publications} ${publications === 1 ? "publication" : "publications"} will be detached`,
      bindings && `${bindings} data ${bindings === 1 ? "binding" : "bindings"} will be deleted`,
      dashboards &&
        `${dashboards} sub-${dashboards === 1 ? "page" : "pages"} will be deleted`,
    ].filter(Boolean) as string[];

    const warning = effects.length
      ? `Delete department "${props.displayName}"?\n\nThis also cleans up:\n  • ${effects.join("\n  • ")}\n\nThis cannot be undone.`
      : `Delete department "${props.displayName}"?\n\nNothing else is attached to it.`;

    if (!confirm(warning)) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/departments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: props.slug }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setFeedback(b?.error || `Delete failed (${res.status})`);
        return;
      }
      router.replace("/admin/departments");
    } catch {
      setFeedback("Delete failed — network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onSave}
        className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-3"
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
            <span className="opacity-70">Route prefix</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
              value={routePrefix}
              onChange={(e) => setRoutePrefix(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Order</span>
            <input
              type="number"
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {feedback && <p className="text-xs opacity-70">{feedback}</p>}
      </form>

      <section className="border border-red-500/20 rounded-lg p-4 flex flex-col gap-3">
        <h2 className="font-medium text-red-500">Danger zone</h2>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="self-start text-xs px-3 py-1.5 rounded border border-red-500/40 hover:bg-red-500/10 disabled:opacity-50"
        >
          Delete this department
        </button>
      </section>
    </div>
  );
}
