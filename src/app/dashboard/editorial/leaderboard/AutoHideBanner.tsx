"use client";

import { useEffect, useState } from "react";

const HIDE_AFTER_MS = 5000;

export default function AutoHideBanner({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return <>{children}</>;
}
