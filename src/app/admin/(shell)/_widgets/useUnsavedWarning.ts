"use client";

import { useEffect } from "react";

const MESSAGE = "You have unsaved changes. Leave without saving?";

/**
 * Warns before losing edits, covering both ways out of a form:
 *
 *  - closing, reloading, or typing a new URL — the browser's own prompt, which
 *    is the only thing that can block those and cannot be customised;
 *  - clicking a link inside the app — the App Router gives no navigation event
 *    to hook, so links are intercepted during the capture phase before Next's
 *    own handler sees the click.
 *
 * Pass whether the form currently differs from what was loaded.
 */
export function useUnsavedWarning(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy assignment; browsers show their own wording either way.
      e.returnValue = MESSAGE;
      return MESSAGE;
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      // Modified clicks open a new tab and leave this page intact.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      if (!confirm(MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
