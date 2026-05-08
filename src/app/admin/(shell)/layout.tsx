import Link from "next/link";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import LogoutButton from "../_components/LogoutButton";

type NavGroup = {
  label?: string;
  items: { href: string; label: string }[];
};

const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: "/admin", label: "Overview" }] },
  {
    items: [
      { href: "/admin/people", label: "People" },
      { href: "/admin/birthdays", label: "Birthdays" },
      { href: "/admin/holidays", label: "Holidays" },
      { href: "/admin/brands", label: "Publications" },
      { href: "/admin/departments", label: "Departments" },
    ],
  },
  {
    items: [
      { href: "/admin/bindings", label: "Data bindings" },
      { href: "/admin/page-settings", label: "Page settings" },
    ],
  },
  {
    items: [
      { href: "/admin/cache", label: "Cache" },
      { href: "/admin/logs", label: "Activity logs" },
      { href: "/admin/others", label: "Others" },
    ],
  },
];

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <div className="admin-shell min-h-screen flex bg-[var(--admin-bg)] text-[var(--admin-fg)]">
      <aside className="w-72 shrink-0 border-r border-black/10 dark:border-white/10 p-6 flex flex-col gap-1 bg-black/[0.02] dark:bg-white/[0.02] sticky top-0 h-screen overflow-y-auto self-start">
        <div className="mb-4 text-sm uppercase tracking-[0.18em] opacity-60 font-semibold">
          CMG Admin
        </div>
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className="flex flex-col gap-1">
            {i > 0 && <div className="my-3 border-t border-black/10 dark:border-white/10" />}
            {group.label && (
              <div className="px-3 pt-1 pb-1 text-[11px] uppercase tracking-wider opacity-60 font-medium">
                {group.label}
              </div>
            )}
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2.5 rounded-lg text-base hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
        <div className="mt-auto pt-5 border-t border-black/10 dark:border-white/10 flex flex-col gap-3">
          <Link
            href="/"
            className="text-sm opacity-75 hover:opacity-100 px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            ↗ Open dashboards
          </Link>
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-sm opacity-70 truncate">{session.username}</span>
            <LogoutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-8 py-12 md:px-12 md:py-14">
          {children}
        </div>
      </main>
    </div>
  );
}
