"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import RemoveButton from "../_widgets/RemoveButton";
import QuickLinkFields, { isoToLocal, type QuickLinkDraft } from "./QuickLinkFields";
import { saveQuickLink } from "./saveQuickLink";

export type ClientQuickLink = {
  id: string;
  label: string;
  href: string;
  description?: string;
  order: number;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export default function QuickLinksTable({ rows }: { rows: ClientQuickLink[] }) {
  return (
    <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-black/5 dark:bg-white/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Text</th>
            <th className="px-3 py-2 font-medium">Link</th>
            <th className="px-3 py-2 font-medium w-52">Status</th>
            <th className="px-3 py-2 font-medium w-40 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center opacity-60">
                No quick links yet. Add one below and it appears on the home page.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <Row key={r.id} row={r} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function draftFrom(row: ClientQuickLink): QuickLinkDraft {
  return {
    id: row.id,
    label: row.label,
    href: row.href,
    description: row.description ?? "",
    order: row.order,
    active: row.active,
    startsAt: isoToLocal(row.startsAt),
    endsAt: isoToLocal(row.endsAt),
  };
}

type Status = { text: string; tone: "live" | "pending" | "off" };

/**
 * Rendered client-side against the browser clock so the status stays honest on
 * a page that was server-rendered minutes ago.
 */
function statusOf(row: ClientQuickLink): Status {
  if (!row.active) return { text: "Switched off", tone: "off" };
  const now = Date.now();
  const start = row.startsAt ? Date.parse(row.startsAt) : null;
  const end = row.endsAt ? Date.parse(row.endsAt) : null;
  if (start !== null && !Number.isNaN(start) && now < start) {
    return { text: `Starts ${formatWhen(row.startsAt)}`, tone: "pending" };
  }
  if (end !== null && !Number.isNaN(end) && now >= end) {
    return { text: `Ended ${formatWhen(row.endsAt)}`, tone: "off" };
  }
  if (end !== null && !Number.isNaN(end)) {
    return { text: `Live until ${formatWhen(row.endsAt)}`, tone: "live" };
  }
  return { text: "Live", tone: "live" };
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TONE_CLASS: Record<Status["tone"], string> = {
  live: "text-green-600 dark:text-green-400",
  pending: "text-amber-600 dark:text-amber-400",
  off: "opacity-50",
};

/** Nothing to subscribe to — the store only distinguishes server from client. */
const subscribeNothing = () => () => {};

/**
 * The status depends on the current clock and on the reader's timezone, neither
 * of which the server share, so it is rendered only after mount — an empty cell
 * for one frame beats a hydration mismatch on every row.
 */
function ScheduleCell({ row }: { row: ClientQuickLink }) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!mounted) return <td className="px-3 py-2 text-xs" />;

  const status = statusOf(row);
  return (
    <td className={`px-3 py-2 text-xs ${TONE_CLASS[status.tone]}`}>
      {status.text}
      {row.startsAt && row.endsAt && (
        <div className="opacity-60 mt-0.5">
          {formatWhen(row.startsAt)} → {formatWhen(row.endsAt)}
        </div>
      )}
    </td>
  );
}

function Row({ row }: { row: ClientQuickLink }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuickLinkDraft>(() => draftFrom(row));

  async function save() {
    setBusy(true);
    setError(null);
    const err = await saveQuickLink(draft);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <tr className="border-t border-black/10 dark:border-white/10 align-top">
        <td colSpan={4} className="px-3 py-3">
          <div className="flex flex-col gap-3 max-w-3xl">
            <QuickLinkFields
              draft={draft}
              onChange={setDraft}
              busy={busy}
              showId={false}
            />
            <div className="flex items-center gap-2">
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
                  setDraft(draftFrom(row));
                  setError(null);
                  setEditing(false);
                }}
                disabled={busy}
                className="rounded border border-black/15 dark:border-white/15 px-2.5 py-1 text-xs disabled:opacity-50"
              >
                Cancel
              </button>
              {error && <span className="text-xs text-red-500">{error}</span>}
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-black/10 dark:border-white/10 align-top">
      <td className="px-3 py-2">
        <div className="font-medium leading-tight">{row.label}</div>
        {row.description && (
          <div className="text-xs opacity-60 mt-0.5">{row.description}</div>
        )}
      </td>
      <td className="px-3 py-2 font-mono text-xs max-w-xs truncate">
        <a href={row.href} target="_blank" rel="noreferrer" className="underline">
          {row.href}
        </a>
      </td>
      <ScheduleCell row={row} />
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setDraft(draftFrom(row));
              setError(null);
              setEditing(true);
            }}
            className="rounded border border-black/15 dark:border-white/15 px-2.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
          >
            Edit
          </button>
          <RemoveButton
            entity="quick-links"
            payload={{ id: row.id }}
            describe={row.label}
          />
        </div>
      </td>
    </tr>
  );
}
