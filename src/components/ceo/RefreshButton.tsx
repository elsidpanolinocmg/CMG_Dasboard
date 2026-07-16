"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import styles from "./ceo-dashboard.module.css";

/** Refetches on the server. Holds the current render rather than flashing a skeleton. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={styles.refresh}
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
    >
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
