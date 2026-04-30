import Link from "next/link";
import { getDb } from "@/lib/db";
import Hint from "../_widgets/Hint";

export const dynamic = "force-dynamic";

const ITEMS = [
  {
    href: "/admin/admin-references",
    label: "Admin references",
    description: "Quick-access bookmark links shown on the admin dashboard.",
    collection: "admin_references",
  },
  {
    href: "/admin/saved-references",
    label: "Saved references",
    description: "Bookmarked Google Sheets used for ad-hoc reference.",
    collection: "saved_references",
  },
];

export default async function OthersPage() {
  const db = await getDb();
  const counts = await Promise.all(
    ITEMS.map((it) => db.collection(it.collection).estimatedDocumentCount()),
  );
  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h1 className="font-semibold">
          Others
          <Hint>
            Less-frequently-used admin areas grouped here to keep the sidebar
            focused.
          </Hint>
        </h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ITEMS.map((it, i) => (
          <Link
            key={it.href}
            href={it.href}
            className="border border-black/10 dark:border-white/10 rounded-lg p-4 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{it.label}</span>
              <span className="text-xs opacity-60">{counts[i]}</span>
            </div>
            <p className="text-xs opacity-60 mt-1">{it.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
