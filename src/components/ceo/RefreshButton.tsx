"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { clearCeoCache } from "@/app/dashboard/ceo/actions";
import styles from "./ceo-dashboard.module.css";

/**
 * Refetches on the server. Holds the current render rather than flashing a
 * skeleton. `className` overrides the default masthead pill styling — used to
 * match the dashboard-controls overlay when it lives there instead.
 *
 * `clearCache` names the board's cache prefixes: they're cleared first, so a press
 * reads the sheet now rather than returning the copy the board cached a few
 * minutes ago. (The timed auto-refresh deliberately doesn't do this.)
 */
export function RefreshButton({ className, clearCache }: { className?: string; clearCache?: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className ?? styles.refresh}
      onClick={() =>
        startTransition(async () => {
          if (clearCache?.length) await clearCeoCache(clearCache);
          router.refresh();
        })
      }
      disabled={pending}
    >
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
