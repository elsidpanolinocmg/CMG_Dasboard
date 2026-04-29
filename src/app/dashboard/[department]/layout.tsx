import Link from "next/link";
import { notFound } from "next/navigation";
import * as departments from "@/lib/repos/departments";
import * as dashboardsRepo from "@/lib/repos/dashboards";
import { humanize } from "@/lib/util/format";

export const dynamic = "force-dynamic";

export default async function DepartmentDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ department: string }>;
}) {
  const { department: rawDept } = await params;
  const dept = decodeURIComponent(rawDept).toLowerCase();
  const row = await departments.findBySlug(dept);
  if (!row || !row.enabled) notFound();

  const subPages = await dashboardsRepo.listByDepartment(dept);
  const navItems = subPages
    .filter((s) => s.slug !== "overview")
    .map((s) => ({
      href: s.routePath,
      label: humanize(s.slug),
      slug: s.slug,
    }));

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-black/10 dark:border-white/10 px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-xs opacity-60 hover:opacity-100">
          ← All departments
        </Link>
        <h1 className="text-lg font-semibold">{row.displayName}</h1>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link
            href={row.routePrefix}
            className="px-3 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
          >
            Overview
          </Link>
          {navItems.map((n) => (
            <Link
              key={n.slug}
              href={n.href}
              className="px-3 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
