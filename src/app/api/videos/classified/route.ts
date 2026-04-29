import { NextRequest, NextResponse } from "next/server";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import { fetchVimeoVideos, type VimeoVideo } from "@/lib/sources/vimeo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Department = "editorial" | "awards" | "bizzcon";
type Format = "shorts" | "long-form";

const VALID_FORMATS = new Set<Format>(["shorts", "long-form"]);
const VALID_DEPARTMENTS = new Set<Department>(["editorial", "awards", "bizzcon"]);

function classifyDepartment(title: string): Department {
  const t = (title || "").toLowerCase();
  if (t.includes("bizzcon")) return "bizzcon";
  if (t.includes("award")) return "awards";
  return "editorial";
}

function classifyFormat(width?: number, height?: number): Format {
  if (!width || !height) return "long-form";
  return height > width ? "shorts" : "long-form";
}

function filter(videos: VimeoVideo[], dept: Department, format: Format): VimeoVideo[] {
  return videos.filter(
    (v) =>
      classifyDepartment(v.title) === dept &&
      classifyFormat(v.width, v.height) === format,
  );
}

export async function GET(req: NextRequest) {
  const deptParam = req.nextUrl.searchParams.get("department")?.toLowerCase().trim() ?? "";
  const formatParam = (req.nextUrl.searchParams.get("format") ?? "long-form") as Format;
  if (!VALID_DEPARTMENTS.has(deptParam as Department)) {
    return NextResponse.json(
      { error: "department must be editorial, awards, or bizzcon" },
      { status: 400 },
    );
  }
  if (!VALID_FORMATS.has(formatParam)) {
    return NextResponse.json(
      { error: "format must be shorts or long-form" },
      { status: 400 },
    );
  }
  const dept = deptParam as Department;

  const videos = await getCache().getOrLoad(
    cacheKeys.videosByDepartment(dept, formatParam),
    async () => {
      const all = await fetchVimeoVideos(undefined, 300);
      return filter(all, dept, formatParam);
    },
    { ttlMs: ttls.VIDEOS, staleMs: ttls.VIDEOS_STALE },
  );
  return NextResponse.json({ department: dept, format: formatParam, videos });
}
