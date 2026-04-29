import Link from "next/link";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import LogoutButton from "../_components/LogoutButton";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/departments", label: "Departments" },
  { href: "/admin/brands", label: "Brands" },
  { href: "/admin/dashboards", label: "Dashboards" },
  { href: "/admin/data-sources", label: "Data sources" },
  { href: "/admin/bindings", label: "Bindings" },
  { href: "/admin/admin-references", label: "Admin references" },
  { href: "/admin/saved-references", label: "Saved references" },
  { href: "/admin/cache", label: "Cache" },
];

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-black/10 dark:border-white/10 p-4 flex flex-col gap-1 text-sm">
        <div className="mb-2 text-xs uppercase tracking-wide opacity-50">CMG Admin</div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-2 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
          >
            {item.label}
          </Link>
        ))}
        <div className="mt-auto pt-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
          <span className="text-xs opacity-60 truncate">{session.username}</span>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
