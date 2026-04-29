import Link from "next/link";
import * as departments from "@/lib/repos/departments";

export const dynamic = "force-dynamic";

export default async function DashboardLandingPage() {
  const depts = await departments.listEnabled();
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">CMG Dashboard</h1>
      <p className="opacity-70 text-sm">Pick a department.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {depts.map((d) => (
          <Link
            key={d.slug}
            href={d.routePrefix}
            className="border border-black/10 dark:border-white/10 rounded-lg p-6 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div className="text-xl font-semibold">{d.displayName}</div>
            <div className="text-xs opacity-60 font-mono mt-1">{d.routePrefix}</div>
          </Link>
        ))}
      </div>
      <div className="mt-8 text-sm">
        <Link href="/admin" className="opacity-60 hover:opacity-100 underline">
          Admin →
        </Link>
      </div>
    </main>
  );
}
