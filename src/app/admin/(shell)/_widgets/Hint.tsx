"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";

export default function Hint({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label="More info"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="ml-1.5 inline-flex items-center justify-center opacity-35 hover:opacity-90 transition-opacity cursor-help"
      >
        <Info size={15} strokeWidth={2} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 w-72 max-w-[80vw] rounded-lg border border-black/10 dark:border-white/15 bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-xs font-normal leading-relaxed tracking-normal shadow-lg pointer-events-none"
        >
          {children}
        </span>
      )}
    </span>
  );
}
