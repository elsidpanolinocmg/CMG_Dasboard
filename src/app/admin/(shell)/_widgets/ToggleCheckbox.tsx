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

  async function toggle(next: boolean) {
    setChecked(next);
    setBusy(true);
    const res = await fetch(`/api/admin/${entity}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...identifier, [field]: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setChecked(!next);
    } else {
      router.refresh();
    }
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={busy}
      onChange={(e) => {
        e.stopPropagation();
        toggle(e.target.checked);
      }}
      onClick={(e) => e.stopPropagation()}
      title={title}
      className="cursor-pointer"
    />
  );
}
