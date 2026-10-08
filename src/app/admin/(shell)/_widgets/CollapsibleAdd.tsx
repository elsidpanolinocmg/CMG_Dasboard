"use client";

import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";

export default function CollapsibleAdd({
  label = "Add new",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Older callers pass "+ Add …"; the icon replaces the plus sign.
  const text = label.replace(/^\+\s*/, "");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3.5 py-2 text-sm font-medium hover:opacity-90"
      >
        <Plus size={16} strokeWidth={2.25} />
        {text}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1 text-xs opacity-60 hover:opacity-100"
        >
          <X size={14} />
          Cancel
        </button>
      </div>
      {children}
    </div>
  );
}
