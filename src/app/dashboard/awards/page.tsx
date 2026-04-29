import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AwardsPage() {
  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto flex flex-col gap-4">
      <Link href="/dashboard" className="text-xs opacity-60 hover:opacity-100">
        ← All departments
      </Link>
      <h1 className="text-3xl font-semibold">Awards</h1>
      <p className="opacity-70 text-sm">
        Awards grid (upcoming awards table from Drupal scraping) is built next.
        Sub-pages: <Link href="/dashboard/awards/videos" className="underline">Videos</Link>{" "}
        · <Link href="/dashboard/awards/shorts" className="underline">Shorts</Link> ·{" "}
        <Link href="/dashboard/awards/leaderboard" className="underline">Leaderboard</Link>
      </p>
    </main>
  );
}
