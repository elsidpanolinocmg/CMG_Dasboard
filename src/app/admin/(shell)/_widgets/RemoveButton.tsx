"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RemoveButton({
  entity,
  payload,
  label = "Remove",
}: {
  entity: string;
  payload: Record<string, unknown>;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Remove this row?")) return;
        setBusy(true);
        const res = await fetch(`/api/admin/${entity}/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setBusy(false);
        if (res.ok) router.refresh();
      }}
      className="text-xs px-2 py-1 rounded border border-black/15 dark:border-white/15 hover:bg-red-500/10 hover:border-red-500/40 disabled:opacity-50"
    >
      {busy ? "…" : label}
    </button>
  );
}
