"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ToggleCheckbox({
  entity,
  field,
  identifier,
  initial,
  title,
}: {
  entity: string;
  field: string;
  identifier: Record<string, unknown>;
  initial: boolean;
  title?: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setChecked(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/${entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...identifier, [field]: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Put the box back where it was, and say why — a checkbox that silently
        // springs back reads as a broken page.
        setChecked(!next);
        setError(body?.error || `Save failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setChecked(!next);
      setError("Save failed — network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={busy}
        onChange={(e) => {
          e.stopPropagation();
          toggle(e.target.checked);
        }}
        onClick={(e) => e.stopPropagation()}
        title={error ?? title}
        className="cursor-pointer"
      />
      {error && (
        <span className="text-xs text-red-500" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
