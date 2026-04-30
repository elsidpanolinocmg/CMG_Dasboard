import { getCache, cachePrefixes } from "./index";

export async function invalidateDeptCaches(...slugs: string[]): Promise<void> {
  const unique = Array.from(new Set(slugs.filter((s) => s && s.length > 0)));
  if (unique.length === 0) return;
  const cache = getCache();
  await Promise.all(
    unique.map((dept) => {
      const prefix =
        dept in cachePrefixes
          ? (cachePrefixes as Record<string, string>)[dept]
          : `${dept}:`;
      return cache.invalidate(prefix, { prefix: true });
    }),
  );
}
