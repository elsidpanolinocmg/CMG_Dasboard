import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/lib/db";
import Hint from "./_widgets/Hint";

const PRIMARY = [
  { collection: "people", label: "People", href: "/admin/people" },
  { collection: "brands", label: "Publications", href: "/admin/brands" },
  { collection: "departments", label: "Departments", href: "/admin/departments" },
];

const UTILITY = [
  { collection: "cache_entries", label: "Cache entries", href: "/admin/cache" },
];

const ALL = [...PRIMARY, ...UTILITY];

async function getCounts(): Promise<Record<string, number>> {
  const db = await getDb();
  const out: Record<string, number> = {};
  await Promise.all(
    ALL.map(async (s) => {
      out[s.collection] = await db.collection(s.collection).estimatedDocumentCount();
    }),
  );
  return out;
}

function CardSkeleton({ size }: { size: "lg" | "sm" }) {
  return (
    <div
      className={
        size === "lg"
          ? "border border-black/10 dark:border-white/10 rounded-2xl p-6 bg-black/[0.015] dark:bg-white/[0.02]"
          : "border border-black/10 dark:border-white/10 rounded-xl p-4 bg-black/[0.015] dark:bg-white/[0.02]"
      }
    >
      <div className={size === "lg" ? "text-xs uppercase tracking-[0.14em] opacity-60 font-medium" : "text-[11px] uppercase tracking-[0.12em] opacity-60 font-medium"}>
        &nbsp;
      </div>
      <div className={size === "lg" ? "text-4xl font-semibold mt-3 tabular-nums opacity-30" : "text-2xl font-semibold mt-2 tabular-nums opacity-30"}>
        —
      </div>
    </div>
  );
}

async function CountsGrids() {
  const counts = await getCounts();
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {PRIMARY.map((s) => (
          <Link
            key={s.collection}
            href={s.href}
            className="group border border-black/10 dark:border-white/10 rounded-2xl p-6 bg-black/[0.015] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:border-black/20 dark:hover:border-white/20 transition-colors"
          >
            <div className="text-xs uppercase tracking-[0.14em] opacity-60 font-medium">
              {s.label}
            </div>
            <div className="text-4xl font-semibold mt-3 tabular-nums">
              {counts[s.collection] ?? 0}
            </div>
          </Link>
        ))}
      </div>

      <div className="border-t border-black/10 dark:border-white/10" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {UTILITY.map((s) => (
          <Link
            key={s.collection}
            href={s.href}
            className="group border border-black/10 dark:border-white/10 rounded-xl p-4 bg-black/[0.015] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:border-black/20 dark:hover:border-white/20 transition-colors"
          >
            <div className="text-[11px] uppercase tracking-[0.12em] opacity-60 font-medium">
              {s.label}
            </div>
            <div className="text-2xl font-semibold mt-2 tabular-nums">
              {counts[s.collection] ?? 0}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function CountsFallback() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {PRIMARY.map((s) => (
          <CardSkeleton key={s.collection} size="lg" />
        ))}
      </div>
      <div className="border-t border-black/10 dark:border-white/10" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {UTILITY.map((s) => (
          <CardSkeleton key={s.collection} size="sm" />
        ))}
      </div>
    </>
  );
}

export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-semibold">
          Overview
          <Hint>Quick counts across the core collections.</Hint>
        </h1>
      </div>
      <Suspense fallback={<CountsFallback />}>
        <CountsGrids />
      </Suspense>
    </div>
  );
}
