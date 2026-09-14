"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import RemoveButton from "../_widgets/RemoveButton";
import CustomPageEditor from "./CustomPageEditor";

export type ClientCustomPage = {
  id: string;
  title: string;
  mediaKind: "image" | "video";
  mediaPath: string;
  active: boolean;
  order: number;
  startsAt: string | null;
  endsAt: string | null;
  showOnHome: boolean;
  rotationPageKeys: string[];
  includeInNext: boolean;
  showTitle: boolean;
  finishVideo: boolean;
};

export type RotationPage = { key: string; label: string };

export default function CustomPagesManager({
  pages,
  rotationPages,
}: {
  pages: ClientCustomPage[];
  rotationPages: RotationPage[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {showAdd && (
        <CustomPageEditor
          mode="create"
          rotationPages={rotationPages}
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
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium w-52">Status</th>
              <th className="px-3 py-2 font-medium">Shows on</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center opacity-60">
                  No custom pages yet.
                </td>
              </tr>
            )}
            {pages.map((p) =>
              editingId === p.id ? (
                <tr key={p.id} className="border-t border-black/10 dark:border-white/10">
                  <td colSpan={5} className="p-3">
                    <CustomPageEditor
                      mode="edit"
                      initial={p}
                      rotationPages={rotationPages}
                      onSaved={() => {
                        setEditingId(null);
                        router.refresh();
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-t border-black/10 dark:border-white/10 align-top">
                  <td className="px-3 py-2">
                    {p.mediaKind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.mediaPath} alt={p.title} className="h-12 w-20 object-cover rounded" />
                    ) : (
                      <video src={p.mediaPath} className="h-12 w-20 object-cover rounded bg-black" muted />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium leading-tight">{p.title}</div>
                    <a
                      href={`/custom/${encodeURIComponent(p.id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono underline opacity-70"
                    >
                      /custom/{p.id}
                    </a>
                  </td>
                  <StatusCell page={p} />
                  <td className="px-3 py-2 text-xs">
                    <ShowsOn page={p} rotationPages={rotationPages} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setEditingId(p.id)}
                        className="rounded border border-black/15 dark:border-white/15 px-2.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        Edit
                      </button>
                      <RemoveButton entity="custom-pages" payload={{ id: p.id }} describe={p.title} />
                    </div>
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
          + Add custom page
        </button>
      )}
    </div>
  );
}

function ShowsOn({ page, rotationPages }: { page: ClientCustomPage; rotationPages: RotationPage[] }) {
  const labels = page.rotationPageKeys.map(
    (k) => rotationPages.find((r) => r.key === k)?.label ?? k,
  );
  return (
    <div className="flex flex-col gap-1">
      <span className={page.showOnHome ? "" : "opacity-50"}>
        Home page link: {page.showOnHome ? "yes" : "no"}
      </span>
      {labels.length === 0 ? (
        <span className="opacity-50">Not in any rotation</span>
      ) : (
        <span>
          Rotation ({page.includeInNext ? "timer + Next" : "timer only"}):{" "}
          <span className="opacity-70">{labels.join(", ")}</span>
        </span>
      )}
    </div>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const subscribeNothing = () => () => {};

/** Clock- and timezone-dependent, so rendered only after mount (see QuickLinksTable). */
function StatusCell({ page }: { page: ClientCustomPage }) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!mounted) return <td className="px-3 py-2 text-xs" />;
  const { text, tone } = statusOf(page);
  return <td className={`px-3 py-2 text-xs ${tone}`}>{text}</td>;
}

function statusOf(page: ClientCustomPage): { text: string; tone: string } {
  let text = "Live";
  let tone = "text-green-600 dark:text-green-400";
  const now = Date.now();
  const start = page.startsAt ? Date.parse(page.startsAt) : NaN;
  const end = page.endsAt ? Date.parse(page.endsAt) : NaN;
  if (!page.active) {
    text = "Switched off";
    tone = "opacity-50";
  } else if (!Number.isNaN(start) && now < start) {
    text = `Starts ${formatWhen(page.startsAt)}`;
    tone = "text-amber-600 dark:text-amber-400";
  } else if (!Number.isNaN(end) && now >= end) {
    text = `Ended ${formatWhen(page.endsAt)}`;
    tone = "opacity-50";
  } else if (!Number.isNaN(end)) {
    text = `Live until ${formatWhen(page.endsAt)}`;
  }
  return { text, tone };
}
