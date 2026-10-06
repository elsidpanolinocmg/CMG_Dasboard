"use client";

import { useState } from "react";

/** Sidebar button that makes every open dashboard screen reload. */
export default function RefreshScreensButton() {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  async function onClick() {
    if (!window.confirm("Reload every open dashboard screen? They refresh within about a minute.")) {
      return;
    }
    setState("busy");
    const res = await fetch("/api/admin/screens/reload", { method: "POST" }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
    setTimeout(() => setState("idle"), 5000);
  }

  return (
    <button
      type="button"
      disabled={state === "busy"}
      onClick={onClick}
      className="text-left text-sm px-3 py-2 rounded-lg border border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
    >
      {state === "busy"
        ? "Sending…"
        : state === "sent"
          ? "✓ Screens will refresh within a minute"
          : state === "error"
            ? "Couldn't send — try again"
            : "⟳ Refresh all screens"}
    </button>
  );
}
