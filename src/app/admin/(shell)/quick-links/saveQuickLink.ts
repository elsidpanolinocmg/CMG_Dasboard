import { localToIso, normalizeHref, type QuickLinkDraft } from "./QuickLinkFields";

/**
 * Posts a draft through the generic admin entity route. Returns an error
 * message, or null on success.
 */
export async function saveQuickLink(draft: QuickLinkDraft): Promise<string | null> {
  const id = draft.id.trim();
  const label = draft.label.trim();
  const href = normalizeHref(draft.href);
  if (!id) return "ID is required";
  if (!label) return "Text is required";
  if (!href) return "Link is required";

  const startsAt = localToIso(draft.startsAt);
  const endsAt = localToIso(draft.endsAt);
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    return "The end must be after the start";
  }

  const res = await fetch("/api/admin/quick-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      label,
      href,
      description: draft.description.trim() || undefined,
      order: Number.isFinite(draft.order) ? draft.order : 0,
      active: draft.active,
      // Explicit null clears a previously saved date; undefined would leave the
      // stored value in place, because upsert only $sets what it is given.
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return body?.error || `Save failed (${res.status})`;
  }
  return null;
}
