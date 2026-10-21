import { Suspense } from "react";
import Link from "next/link";
import {
  Building2,
  Cake,
  CalendarDays,
  HardDrive,
  Link2,
  MonitorPlay,
  Newspaper,
  PanelsTopLeft,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getDb } from "@/lib/db";
import Hint from "./_widgets/Hint";

type Card = { collection?: string; label: string; href: string; icon: LucideIcon };

const GROUPS: { label: string; cards: Card[] }[] = [
  {
    label: "Organisation",
    cards: [
      { collection: "people", label: "People", href: "/admin/people", icon: Users },
      { collection: "brands", label: "Publications", href: "/admin/brands", icon: Newspaper },
      { collection: "departments", label: "Departments", href: "/admin/departments", icon: Building2 },
    ],
  },
  {
    label: "Screens",
    cards: [
      { collection: "birthdays", label: "Birthdays", href: "/admin/birthdays", icon: Cake },
      { collection: "custom_pages", label: "Custom pages", href: "/admin/custom-pages", icon: PanelsTopLeft },
      { label: "YouTube channel", href: "/admin/youtube-channel", icon: MonitorPlay },
      { collection: "holidays", label: "Holidays", href: "/admin/holidays", icon: CalendarDays },
    ],
  },
  {
    label: "Other",
    cards: [
      { collection: "quick_links", label: "Quick links", href: "/admin/quick-links", icon: Link2 },
      { collection: "cache_entries", label: "Cache entries", href: "/admin/cache", icon: HardDrive },
    ],
  },
];

const COLLECTIONS = GROUPS.flatMap((g) => g.cards.flatMap((c) => (c.collection ? [c.collection] : [])));

async function getCounts(): Promise<Record<string, number>> {
  const db = await getDb();
  const out: Record<string, number> = {};
  await Promise.all(
    COLLECTIONS.map(async (c) => {
      out[c] = await db.collection(c).estimatedDocumentCount();
    }),
  );
  return out;
}

function CardTile({ card, count }: { card: Card; count?: number | null }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      className="group flex items-center gap-3.5 rounded-xl border border-black/[0.07] dark:border-white/[0.08] px-4 py-3.5 hover:border-black/20 dark:hover:border-white/20 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black/[0.04] dark:bg-white/[0.07]">
        <Icon size={18} strokeWidth={1.75} className="opacity-75" />
      </span>
      <span className="flex-1 text-sm">{card.label}</span>
      {card.collection && (
        <span className="text-lg font-semibold tabular-nums">
          {count === null ? <span className="opacity-25">—</span> : (count ?? 0)}
        </span>
      )}
    </Link>
  );
}

function Grids({ counts }: { counts: Record<string, number> | null }) {
  return (
    <div className="flex flex-col gap-7">
      {GROUPS.map((g) => (
        <section key={g.label} className="flex flex-col gap-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wider opacity-45">{g.label}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.cards.map((c) => (
              <CardTile
                key={c.href}
                card={c}
                count={c.collection ? (counts ? counts[c.collection] : null) : undefined}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

async function CountsGrids() {
  return <Grids counts={await getCounts()} />;
}

export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-semibold">
        Overview
        <Hint>Quick counts across the main collections. Click a card to manage it.</Hint>
      </h1>
      <Suspense fallback={<Grids counts={null} />}>
        <CountsGrids />
      </Suspense>
    </div>
  );
}
