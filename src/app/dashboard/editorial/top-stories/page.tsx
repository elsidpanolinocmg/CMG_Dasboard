import { getTopStories } from "./loadTopStories";
import TopStoriesList from "./TopStoriesList";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The Top 10 most-read stories per period. The earlier wallboard with the
// article preview lives on at ./preview (not linked from anywhere).
export default async function TopStoriesPage({ searchParams }: { searchParams: Promise<{ cache?: string }> }) {
  const params = await searchParams;
  const result = await getTopStories(params.cache === "clear");
  if ("error" in result) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="rounded border border-red-400 bg-red-950 p-6 text-red-200 text-sm">{result.error}</div>
      </div>
    );
  }
  return <TopStoriesList periods={result.periods} />;
}
