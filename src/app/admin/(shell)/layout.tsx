import Link from "next/link";
import { ExternalLink, UserRound } from "lucide-react";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import AdminNav from "../_components/AdminNav";
import LogoutButton from "../_components/LogoutButton";
import RefreshScreensButton from "../_components/RefreshScreensButton";

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <div className="admin-shell min-h-screen flex bg-[var(--admin-bg)] text-[var(--admin-fg)]">
      <aside className="w-60 shrink-0 border-r border-black/[0.07] dark:border-white/[0.08] px-3 py-5 flex flex-col gap-5 sticky top-0 h-screen self-start">
        <Link href="/admin" className="flex items-center gap-2 px-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background text-[11px] font-bold tracking-tight">
            CMG
          </span>
          <span className="text-sm font-semibold">Admin</span>
        </Link>

        {/* Only the menu scrolls, so the footer stays in view on short screens. */}
        <div className="-mx-1 flex-1 min-h-0 overflow-y-auto px-1">
          <AdminNav />
        </div>

        <div className="flex flex-col gap-1 border-t border-black/[0.07] dark:border-white/[0.08] pt-4">
          <RefreshScreensButton />
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm opacity-70 hover:opacity-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            <ExternalLink size={16} strokeWidth={1.75} />
            Open dashboards
          </Link>
          <div className="mt-2 flex items-center gap-2.5 px-2.5">
            <UserRound size={16} strokeWidth={1.75} className="shrink-0 opacity-50" />
            <span className="flex-1 truncate text-sm opacity-70">{session.username}</span>
            <LogoutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-8 py-10 md:px-12">{children}</div>
      </main>
    </div>
  );
}
