"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Cable,
  Cake,
  CalendarDays,
  Database,
  Ellipsis,
  HardDrive,
  LayoutDashboard,
  Link2,
  MonitorPlay,
  Newspaper,
  PanelsTopLeft,
  ScrollText,
  SlidersHorizontal,
  Users,
  Gauge,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label?: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }] },
  {
    label: "Organisation",
    items: [
      { href: "/admin/people", label: "People", icon: Users },
      { href: "/admin/brands", label: "Publications", icon: Newspaper },
      { href: "/admin/departments", label: "Departments", icon: Building2 },
    ],
  },
  {
    label: "Screens",
    items: [
      { href: "/admin/birthdays", label: "Birthdays", icon: Cake },
      { href: "/admin/custom-pages", label: "Custom pages", icon: PanelsTopLeft },
      { href: "/admin/youtube-channel", label: "YouTube channel", icon: MonitorPlay },
      { href: "/admin/holidays", label: "Holidays", icon: CalendarDays },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/admin/bindings", label: "Data bindings", icon: Cable },
      { href: "/admin/data-sources", label: "Data sources", icon: Database },
      { href: "/admin/dashboards", label: "Dashboards", icon: Gauge },
      { href: "/admin/page-settings", label: "Page settings", icon: SlidersHorizontal },
      { href: "/admin/quick-links", label: "Quick links", icon: Link2 },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/cache", label: "Cache", icon: HardDrive },
      { href: "/admin/logs", label: "Activity logs", icon: ScrollText },
      { href: "/admin/others", label: "Others", icon: Ellipsis },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Sidebar navigation, with the current section highlighted. */
export default function AdminNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex flex-col gap-4">
      {NAV_GROUPS.map((group, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {group.label && (
            <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider opacity-45">
              {group.label}
            </div>
          )}
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-black/[0.07] dark:bg-white/[0.1] font-medium"
                    : "opacity-70 hover:opacity-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                }`}
              >
                <Icon size={16} strokeWidth={active ? 2.25 : 1.75} className="shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
