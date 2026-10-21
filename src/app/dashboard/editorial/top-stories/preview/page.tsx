import { getTopStories } from "../loadTopStories";
import TopStoriesClient from "../TopStoriesClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The earlier Top Stories wallboard: the article preview with its typed body
// beside the period's top 5. Kept at this address on purpose but not linked
// from anywhere; the main Top Stories page is now the Top 10 list.
export default async function TopStoriesPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ cache?: string; layout?: string }>;
}) {
  const params = await searchParams;
  const result = await getTopStories(params.cache === "clear");
  if ("error" in result) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="rounded border border-red-400 bg-red-950 p-6 text-red-200 text-sm">{result.error}</div>
      </div>
    );
  }
  // The loader keeps ten per period for the Top 10 list; this page was built
  // around five.
  const periods = result.periods.map((p) => ({ ...p, stories: p.stories.slice(0, 5) }));
  // The "Most read stories" list layout is the default; ?layout=carousel
  // shows the top 5 as cards under the headline instead.
  return <TopStoriesClient periods={periods} layout={params.layout === "carousel" ? "carousel" : "list"} />;
}
