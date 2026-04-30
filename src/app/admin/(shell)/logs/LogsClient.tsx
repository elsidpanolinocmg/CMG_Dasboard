"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export interface ClientLog {
  id: string;
  at: string;
  actorUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  metadata: Record<string, unknown> | undefined;
  ip: string;
  userAgent: string;
}

export default function LogsClient({
  items,
  actors,
  actions,
  currentActor,
  currentAction,
  currentLimit,
}: {
  items: ClientLog[];
  actors: string[];
  actions: string[];
  currentActor: string;
  currentAction: string;
  currentLimit: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp?.toString() ?? "");
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-end text-sm">
        <label className="flex flex-col gap-1">
          <span className="opacity-70 text-xs">Actor</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={currentActor}
            onChange={(e) => setParam("actor", e.target.value)}
          >
            <option value="">All</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="opacity-70 text-xs">Action prefix</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={currentAction}
            onChange={(e) => setParam("action", e.target.value)}
          >
            <option value="">All</option>
            {/* Group prefixes (e.g. "people", "brands") */}
            {Array.from(new Set(actions.map((a) => a.split(".")[0]))).sort().map((prefix) => (
              <option key={`p-${prefix}`} value={prefix}>
                {prefix}.*
              </option>
            ))}
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="opacity-70 text-xs">Limit</span>
          <select
            className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
            value={String(currentLimit)}
            onChange={(e) => setParam("limit", e.target.value)}
          >
            {[50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs opacity-60 ml-auto">{items.length} entries</span>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center opacity-60">
                  No log entries.
                </td>
              </tr>
            )}
            {items.map((l) => {
              const open = openId === l.id;
              return (
                <>
                  <tr
                    key={l.id}
                    className="border-t border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    onClick={() => setOpenId(open ? null : l.id)}
                  >
                    <td className="px-3 py-2 text-xs opacity-70 whitespace-nowrap">
                      {new Date(l.at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{l.actorUsername}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.action}</td>
                    <td className="px-3 py-2 text-xs">
                      {l.targetType && <span className="opacity-60">{l.targetType}</span>}
                      {l.targetId && <span className="ml-1 font-mono">{l.targetId}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs opacity-50">{open ? "▼" : "▶"}</td>
                  </tr>
                  {open && (
                    <tr key={`${l.id}-detail`} className="border-t border-black/10 dark:border-white/10 bg-black/[.02] dark:bg-white/[.02]">
                      <td colSpan={5} className="px-3 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <DetailBox label="Before" value={l.before} />
                          <DetailBox label="After" value={l.after} />
                          {l.metadata && Object.keys(l.metadata).length > 0 && (
                            <DetailBox label="Metadata" value={l.metadata} />
                          )}
                          {(l.ip || l.userAgent) && (
                            <div>
                              <div className="opacity-60 mb-1">Request</div>
                              <div className="font-mono opacity-80 break-all">
                                {l.ip && <div>IP: {l.ip}</div>}
                                {l.userAgent && <div>UA: {l.userAgent}</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) {
    return (
      <div>
        <div className="opacity-60 mb-1">{label}</div>
        <div className="opacity-50 italic">—</div>
      </div>
    );
  }
  return (
    <div>
      <div className="opacity-60 mb-1">{label}</div>
      <pre className="bg-black/5 dark:bg-white/5 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
