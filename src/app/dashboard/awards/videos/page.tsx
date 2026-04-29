import VideoRotator from "@/components/VideoRotator";

export const dynamic = "force-dynamic";

async function fetchClassified() {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/videos/classified?department=awards&format=long-form`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  return json.videos ?? [];
}

export default async function AwardsVideosPage() {
  const videos = await fetchClassified();
  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-4">
      <h2 className="text-sm uppercase tracking-wide opacity-60">Awards · Videos</h2>
      <VideoRotator videos={videos} aspectRatio="16/9" intervalMs={45_000} />
    </div>
  );
}
