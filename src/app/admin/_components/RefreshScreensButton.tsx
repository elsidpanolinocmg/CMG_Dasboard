"use client";

import { useState } from "react";
import { Check, LoaderCircle, RefreshCw, RotateCw, TriangleAlert } from "lucide-react";

type Kind = "soft" | "full";

const CONFIRM: Record<Kind, string> = {
  soft:
    "Refresh the content on every open dashboard screen? Screens stay fullscreen. They update within about a minute.",
  full:
    "Fully reload every open dashboard screen? Only needed after a dashboard update. Screens in fullscreen will drop out of it until someone clicks Fullscreen again.",
};

const ROW =
  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50";

/** Sidebar buttons that make every open dashboard screen refresh. */
export default function RefreshScreensButton() {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  async function send(kind: Kind) {
    if (!window.confirm(CONFIRM[kind])) return;
    setState("busy");
    const res = await fetch("/api/admin/screens/reload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
    setTimeout(() => setState("idle"), 5000);
  }

  const icon =
    state === "busy" ? (
      <LoaderCircle size={16} className="animate-spin" />
    ) : state === "sent" ? (
      <Check size={16} className="text-green-600" />
    ) : state === "error" ? (
      <TriangleAlert size={16} className="text-red-500" />
    ) : (
      <RefreshCw size={16} strokeWidth={1.75} />
    );

  return (
    <div className="flex items-center">
      <button
        type="button"
        disabled={state === "busy"}
        onClick={() => send("soft")}
        title="Updates content and settings on every screen; screens stay fullscreen"
        className={`${ROW} flex-1 ${state === "idle" ? "opacity-70 hover:opacity-100" : ""}`}
      >
        {icon}
        {state === "sent"
          ? "Screens update shortly"
          : state === "error"
            ? "Couldn't send"
            : "Refresh all screens"}
      </button>
      <button
        type="button"
        disabled={state === "busy"}
        onClick={() => send("full")}
        title="Full reload: only after a dashboard update (exits fullscreen)"
        aria-label="Full reload of all screens"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md opacity-45 hover:opacity-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-30"
      >
        <RotateCw size={14} />
      </button>
    </div>
  );
}
