export function normalizeKey(raw: string): string {
  if (!raw) return "";
  const lower = raw.trim().toLowerCase();
  const local = lower.includes("@") ? lower.split("@")[0] : lower;
  return local.replace(/[\s._-]+/g, "");
}

export function buildNameKeys(...inputs: (string | undefined | null)[]): string[] {
  const out = new Set<string>();
  for (const s of inputs) {
    const k = normalizeKey(s ?? "");
    if (k) out.add(k);
  }
  return [...out];
}
