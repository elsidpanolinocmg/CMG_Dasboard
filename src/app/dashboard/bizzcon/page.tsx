import Link from "next/link";

export const dynamic = "force-dynamic";

export default function BizzconPage() {
  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto flex flex-col gap-4">
      <Link href="/dashboard" className="text-xs opacity-60 hover:opacity-100">
        ← All departments
      </Link>
      <h1 className="text-3xl font-semibold">Bizzcon</h1>
      <p className="opacity-70 text-sm">
        Events grid (upcoming events from Drupal scraping) is built next.
        Sub-pages:{" "}
        <Link href="/dashboard/bizzcon/videos" className="underline">Videos</Link> ·{" "}
        <Link href="/dashboard/bizzcon/shorts" className="underline">Shorts</Link> ·{" "}
        <Link href="/dashboard/bizzcon/leaderboard" className="underline">Leaderboard</Link> ·{" "}
        <Link href="/dashboard/bizzcon/sponsorship" className="underline">Sponsorship</Link>
      </p>
    </main>
  );
}
