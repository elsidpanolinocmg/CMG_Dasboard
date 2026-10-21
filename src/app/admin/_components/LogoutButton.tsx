"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      title="Sign out"
      aria-label="Sign out"
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/admin/login");
        router.refresh();
      }}
      className="grid h-7 w-7 place-items-center rounded-md opacity-60 hover:opacity-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-40"
    >
      {busy ? <LoaderCircle size={15} className="animate-spin" /> : <LogOut size={15} />}
    </button>
  );
}
