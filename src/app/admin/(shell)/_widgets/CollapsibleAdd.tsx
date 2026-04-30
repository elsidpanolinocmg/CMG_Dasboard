"use client";

import { useState, type ReactNode } from "react";

export default function CollapsibleAdd({
  label = "+ Add new",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs opacity-60 hover:opacity-100 underline-offset-2 hover:underline"
        >
          Cancel
        </button>
      </div>
      {children}
    </div>
  );
}
