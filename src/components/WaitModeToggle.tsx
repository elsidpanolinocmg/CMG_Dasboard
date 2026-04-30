"use client";

import { useEffect, useState } from "react";

const WAIT_MODE_KEY = "shortsWaitMode";
const WAIT_MODE_EVENT = "shortsModeChange";

export default function WaitModeToggle() {
  const [waitMode, setWaitMode] = useState(false);

  useEffect(() => {
    setWaitMode(localStorage.getItem(WAIT_MODE_KEY) === "true");
  }, []);

  const toggle = () => {
    const next = !waitMode;
    setWaitMode(next);
    localStorage.setItem(WAIT_MODE_KEY, String(next));
    window.dispatchEvent(new Event(WAIT_MODE_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={waitMode}
      className="flex items-center gap-3 px-5 py-3 rounded bg-black/40 text-white text-lg select-none hover:bg-black/60 transition-colors"
    >
      <span
        className={`relative inline-block w-11 h-6 rounded-full transition-colors ${
          waitMode ? "bg-emerald-400" : "bg-white/30"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            waitMode ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      Finish video
    </button>
  );
}
