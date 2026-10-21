"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

export default function RemoveButton({
  entity,
  payload,
  label = "Remove",
  describe,
}: {
  entity: string;
  payload: Record<string, unknown>;
  label?: string;
  /** What to name in the confirm prompt. Defaults to the row's identifiers. */
  describe?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name =
    describe ??
    Object.values(payload)
      .filter((v) => typeof v === "string" && v)
      .join(" / ");

  return (
    <span className="inline-flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-500" role="alert">
          {error}
        </span>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!confirm(name ? `Remove "${name}"?` : "Remove this row?")) return;
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(`/api/admin/${entity}/delete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              setError(body?.error || `Remove failed (${res.status})`);
              return;
            }
            router.refresh();
          } catch {
            setError("Remove failed — network error");
          } finally {
            setBusy(false);
          }
        }}
        title={label}
        aria-label={name ? `${label} ${name}` : label}
        className="grid h-8 w-8 place-items-center rounded-md opacity-55 hover:opacity-100 hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40"
      >
        {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
      </button>
    </span>
  );
}
