import VideoRotator from "@/components/VideoRotator";

export const dynamic = "force-dynamic";

interface VideoApiResponse {
  videos: {
    id: string;
    title: string;
    thumbnail: string;
    width: number;
    height: number;
  }[];
}

async function fetchClassified(dept: string, format: "shorts" | "long-form") {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/videos/classified?department=${encodeURIComponent(dept)}&format=${format}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [] as VideoApiResponse["videos"];
  const json = (await res.json()) as VideoApiResponse;
  return json.videos ?? [];
}

export default async function DepartmentShortsPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: rawDept } = await params;
  const dept = decodeURIComponent(rawDept).toLowerCase();
  const videos = await fetchClassified(dept, "shorts");
  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      <h2 className="text-sm uppercase tracking-wide opacity-60">Shorts</h2>
      <VideoRotator videos={videos} aspectRatio="9/16" intervalMs={30_000} />
    </div>
  );
}
