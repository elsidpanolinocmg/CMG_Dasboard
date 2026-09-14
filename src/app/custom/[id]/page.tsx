import { notFound } from "next/navigation";
import type { Metadata } from "next";
import * as customPagesRepo from "@/lib/repos/customPages";
import CustomPageView from "./CustomPageView";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const page = await customPagesRepo.findById(decodeURIComponent(id)).catch(() => null);
  // Switched-off pages are gone for everyone. The schedule only decides the
  // home-page link and the rotation, so a page can be previewed before it starts.
  return page && page.active !== false ? page : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const page = await load((await params).id);
  return { title: page ? page.title : "Page not found" };
}

export default async function CustomPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const page = await load((await params).id);
  if (!page) notFound();

  return (
    <CustomPageView
      title={page.title}
      mediaKind={page.mediaKind}
      mediaPath={page.mediaPath}
      showTitle={!!page.showTitle}
    />
  );
}
