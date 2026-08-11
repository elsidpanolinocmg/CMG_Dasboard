"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { humanize } from "@/lib/util/format";
import { useUnsavedWarning } from "../_widgets/useUnsavedWarning";

export type ClientBrand = {
  slug: string;
  displayName: string;
  url: string;
  color: string;
  secondaryColor: string;
  image: string;
  group: string;
  ga4PropertyId: string;
  ga4FilterFieldName: string;
  ga4FilterMatchType: string;
  ga4FilterValue: string;
  drupalDomain: string;
  awardsShowcaseId: string;
  departments: string[];
  active: boolean;
  customNewsFeedUrl: string;
  customExclusiveFeedUrl: string;
  customVideosFeedUrl: string;
  customTopReadFeedUrl: string;
  manualEvents: ManualEventRow[];
};

export type ManualEventRow = {
  department: "awards" | "bizzcon";
  title: string;
  date: string;
  city: string;
  link: string;
  image: string;
  submissionStart: string;
  submissionEnd: string;
  contactPerson: string;
};

const FILTER_MATCH_TYPES = ["EXACT", "BEGINS_WITH", "ENDS_WITH", "CONTAINS"] as const;

export default function BrandEditor({
  brand,
  departmentSlugs,
  knownGroups,
}: {
  brand: ClientBrand;
  departmentSlugs: string[];
  knownGroups: string[];
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(brand.displayName);
  const [url, setUrl] = useState(brand.url);
  const [color, setColor] = useState(brand.color);
  const [secondaryColor, setSecondaryColor] = useState(brand.secondaryColor);
  const [group, setGroup] = useState(brand.group);
  const [ga4PropertyId, setGa4PropertyId] = useState(brand.ga4PropertyId);
  const [ga4FilterFieldName, setGa4FilterFieldName] = useState(brand.ga4FilterFieldName);
  const [ga4FilterMatchType, setGa4FilterMatchType] = useState(
    brand.ga4FilterMatchType || "EXACT",
  );
  const [ga4FilterValue, setGa4FilterValue] = useState(brand.ga4FilterValue);
  const [drupalDomain, setDrupalDomain] = useState(brand.drupalDomain);
  const [image, setImage] = useState(brand.image);
  const [awardsShowcaseId, setAwardsShowcaseId] = useState(brand.awardsShowcaseId);
  const [customNewsFeedUrl, setCustomNewsFeedUrl] = useState(brand.customNewsFeedUrl);
  const [customExclusiveFeedUrl, setCustomExclusiveFeedUrl] = useState(
    brand.customExclusiveFeedUrl,
  );
  const [customVideosFeedUrl, setCustomVideosFeedUrl] = useState(brand.customVideosFeedUrl);
  const [customTopReadFeedUrl, setCustomTopReadFeedUrl] = useState(
    brand.customTopReadFeedUrl,
  );
  const [manualEvents, setManualEvents] = useState<ManualEventRow[]>(brand.manualEvents);
  const [active, setActive] = useState(brand.active);
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set(brand.departments));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // This form carries twenty-odd fields plus a repeater; a stray click on the
  // sidebar used to discard the lot without a word.
  const current = {
    displayName,
    url,
    color,
    secondaryColor,
    group,
    ga4PropertyId,
    ga4FilterFieldName,
    ga4FilterMatchType,
    ga4FilterValue,
    drupalDomain,
    image,
    awardsShowcaseId,
    customNewsFeedUrl,
    customExclusiveFeedUrl,
    customVideosFeedUrl,
    customTopReadFeedUrl,
    manualEvents,
    active,
    departments: Array.from(selectedDepts).sort(),
  };
  const original = {
    displayName: brand.displayName,
    url: brand.url,
    color: brand.color,
    secondaryColor: brand.secondaryColor,
    group: brand.group,
    ga4PropertyId: brand.ga4PropertyId,
    ga4FilterFieldName: brand.ga4FilterFieldName,
    ga4FilterMatchType: brand.ga4FilterMatchType || "EXACT",
    ga4FilterValue: brand.ga4FilterValue,
    drupalDomain: brand.drupalDomain,
    image: brand.image,
    awardsShowcaseId: brand.awardsShowcaseId,
    customNewsFeedUrl: brand.customNewsFeedUrl,
    customExclusiveFeedUrl: brand.customExclusiveFeedUrl,
    customVideosFeedUrl: brand.customVideosFeedUrl,
    customTopReadFeedUrl: brand.customTopReadFeedUrl,
    manualEvents: brand.manualEvents,
    active: brand.active,
    departments: [...brand.departments].sort(),
  };
  useUnsavedWarning(
    !busy && JSON.stringify(current) !== JSON.stringify(original),
  );

  function toggleDept(slug: string) {
    setSelectedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    const body: Record<string, unknown> = {
      slug: brand.slug,
      displayName: displayName.trim(),
      active,
      departments: Array.from(selectedDepts),
    };
    // Sent even when empty: the repository unsets empty fields, so clearing one
    // here actually removes it instead of leaving the old value in place.
    body.url = url.trim();
    body.color = color.trim();
    body.secondaryColor = secondaryColor.trim();
    body.group = group.trim();
    body.ga4PropertyId = ga4PropertyId.trim();
    body.drupalDomain = drupalDomain.trim();
    body.image = image.trim();
    body.awardsShowcaseId = awardsShowcaseId.trim();
    // Always sent (even when empty) so clearing a field actually removes the
    // override on save.
    const customFeeds: Record<string, string> = {};
    if (customNewsFeedUrl.trim()) customFeeds.newsFeedUrl = customNewsFeedUrl.trim();
    if (customExclusiveFeedUrl.trim())
      customFeeds.exclusiveFeedUrl = customExclusiveFeedUrl.trim();
    if (customVideosFeedUrl.trim()) customFeeds.videosFeedUrl = customVideosFeedUrl.trim();
    if (customTopReadFeedUrl.trim())
      customFeeds.topReadFeedUrl = customTopReadFeedUrl.trim();
    body.customFeeds = customFeeds;
    // Always sent so removed rows actually disappear on save.
    body.manualEvents = manualEvents
      .filter((ev) => ev.title.trim() && ev.date.trim())
      .map((ev) => ({
        department: ev.department,
        title: ev.title.trim(),
        date: ev.date.trim(),
        ...(ev.city.trim() ? { city: ev.city.trim() } : {}),
        ...(ev.link.trim() ? { link: ev.link.trim() } : {}),
        ...(ev.image.trim() ? { image: ev.image.trim() } : {}),
        ...(ev.submissionStart.trim() ? { submissionStart: ev.submissionStart.trim() } : {}),
        ...(ev.submissionEnd.trim() ? { submissionEnd: ev.submissionEnd.trim() } : {}),
        ...(ev.contactPerson.trim() ? { contactPerson: ev.contactPerson.trim() } : {}),
      }));
    body.ga4Filter =
      ga4FilterFieldName.trim() && ga4FilterValue.trim()
        ? {
            fieldName: ga4FilterFieldName.trim(),
            matchType: ga4FilterMatchType,
            value: ga4FilterValue.trim(),
          }
        : null;

    const res = await fetch("/api/admin/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setFeedback(b?.error || "Save failed");
      return;
    }
    setFeedback("Saved.");
    router.refresh();
  }

  async function onDelete() {
    if (!confirm(`Permanently delete publication "${brand.slug}"?`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/brands/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: brand.slug }),
    });
    setBusy(false);
    if (res.ok) router.replace("/admin/brands");
    else setFeedback("Delete failed");
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={onSave}
        className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-4"
      >
        <h2 className="font-medium">Profile</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Display name</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Website URL</span>
            <input
              type="url"
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-10 h-8 rounded border border-black/15 dark:border-white/15 bg-transparent"
                value={color || "#000000"}
                onChange={(e) => setColor(e.target.value)}
              />
              <input
                className="flex-1 border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#FF0000"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Secondary color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-10 h-8 rounded border border-black/15 dark:border-white/15 bg-transparent"
                value={secondaryColor || "#000000"}
                onChange={(e) => setSecondaryColor(e.target.value)}
              />
              <input
                className="flex-1 border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                placeholder="#FF0000"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Group</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              list="brand-groups"
              placeholder="(optional)"
            />
            <datalist id="brand-groups">
              {knownGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">GA4 property ID</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
              value={ga4PropertyId}
              onChange={(e) => setGa4PropertyId(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm col-span-2">
            <span className="opacity-70">Image (path or URL)</span>
            <input
              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
              value={image}
              onChange={(e) => setImage(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 text-sm border-t border-black/10 dark:border-white/10 pt-3">
          <span className="opacity-70 text-xs uppercase tracking-wide">
            GA4 filter (only when this publication shares a property)
          </span>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Field</span>
              <input
                className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
                value={ga4FilterFieldName}
                onChange={(e) => setGa4FilterFieldName(e.target.value)}
                placeholder="hostName"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Match</span>
              <select
                className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
                value={ga4FilterMatchType}
                onChange={(e) => setGa4FilterMatchType(e.target.value)}
              >
                {FILTER_MATCH_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">Value</span>
              <input
                className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono"
                value={ga4FilterValue}
                onChange={(e) => setGa4FilterValue(e.target.value)}
                placeholder="example.com"
              />
            </label>
          </div>
        </div>

        <details
          className="border-t border-black/10 dark:border-white/10 pt-3"
          open={Boolean(
            customNewsFeedUrl ||
              customExclusiveFeedUrl ||
              customVideosFeedUrl ||
              customTopReadFeedUrl ||
              drupalDomain ||
              awardsShowcaseId,
          )}
        >
          <summary className="cursor-pointer text-xs uppercase tracking-wide opacity-70 select-none">
            Custom data sources (advanced)
          </summary>
          <div className="flex flex-col gap-4 mt-3">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-medium opacity-80">Publication page feeds</span>
              <p className="text-xs opacity-60">
                For publications not built on Drupal (e.g. WordPress sites), the
                automatic feeds don&apos;t exist. Paste each feed&apos;s full URL here
                instead. Leave a field blank to keep the automatic behaviour, or type{" "}
                <code className="font-mono">off</code> to hide that section on the
                dashboard.
                {selectedDepts.has("editorial") && (
                  <> The editorial screens use these same feeds.</>
                )}
              </p>
              <div className="grid grid-cols-1 gap-3">
                {(
                  [
                    {
                      label: "News ticker feed (RSS/Atom)",
                      value: customNewsFeedUrl,
                      set: setCustomNewsFeedUrl,
                      placeholder: "https://www.example.com/feed/",
                    },
                    {
                      label: "Exclusives card feed (RSS/Atom)",
                      value: customExclusiveFeedUrl,
                      set: setCustomExclusiveFeedUrl,
                      placeholder: "https://www.example.com/category/exclusive/feed/",
                    },
                    {
                      label: "Videos feed (XML)",
                      value: customVideosFeedUrl,
                      set: setCustomVideosFeedUrl,
                      placeholder: "https://www.example.com/videos.xml — or: off",
                    },
                    {
                      label: "Top read feed (XML)",
                      value: customTopReadFeedUrl,
                      set: setCustomTopReadFeedUrl,
                      placeholder: "https://www.example.com/top-read.xml — or: off",
                    },
                  ] as const
                ).map((f) => (
                  <label key={f.label} className="flex flex-col gap-1 text-sm">
                    <span className="opacity-70">{f.label}</span>
                    <input
                      className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
                      value={f.value}
                      onChange={(e) => f.set(e.target.value)}
                      placeholder={f.placeholder}
                    />
                  </label>
                ))}
              </div>
            </div>

            {(selectedDepts.has("editorial") ||
              selectedDepts.has("awards") ||
              selectedDepts.has("bizzcon")) && (
              <div className="flex flex-col gap-2 border-t border-black/10 dark:border-white/10 pt-3">
                <span className="text-xs font-medium opacity-80">
                  Department sources
                </span>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="opacity-70">Drupal domain (videos/shorts source)</span>
                  <input
                    className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
                    value={drupalDomain}
                    onChange={(e) => setDrupalDomain(e.target.value)}
                    placeholder="example.com — Drupal-built sites only"
                  />
                </label>
                {selectedDepts.has("awards") && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="opacity-70">Awards showcase ID</span>
                    <input
                      className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
                      value={awardsShowcaseId}
                      onChange={(e) => setAwardsShowcaseId(e.target.value)}
                    />
                  </label>
                )}
                {(selectedDepts.has("awards") || selectedDepts.has("bizzcon")) && (
                <>
                <p className="text-xs opacity-60">
                  The awards and BizzCon listings are read from the publication&apos;s
                  Drupal site. For non-Drupal publications, add the events by hand
                  below — they appear in the grids alongside the automatic ones.
                </p>

                <div className="flex flex-col gap-3">
                  <span className="opacity-70 text-sm">Manual events</span>
                  {manualEvents.map((ev, i) => (
                    <div
                      key={i}
                      className="border border-black/10 dark:border-white/10 rounded p-3 grid grid-cols-2 gap-2"
                    >
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="opacity-70">Shown in</span>
                        <select
                          className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
                          value={ev.department}
                          onChange={(e) =>
                            setManualEvents((prev) =>
                              prev.map((p, j) =>
                                j === i
                                  ? { ...p, department: e.target.value as "awards" | "bizzcon" }
                                  : p,
                              ),
                            )
                          }
                        >
                          {selectedDepts.has("awards") && <option value="awards">Awards</option>}
                          {selectedDepts.has("bizzcon") && (
                            <option value="bizzcon">BizzCon</option>
                          )}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="opacity-70">Event date</span>
                        <input
                          type="date"
                          className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
                          value={ev.date}
                          onChange={(e) =>
                            setManualEvents((prev) =>
                              prev.map((p, j) => (j === i ? { ...p, date: e.target.value } : p)),
                            )
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm col-span-2">
                        <span className="opacity-70">Title</span>
                        <input
                          className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
                          value={ev.title}
                          onChange={(e) =>
                            setManualEvents((prev) =>
                              prev.map((p, j) => (j === i ? { ...p, title: e.target.value } : p)),
                            )
                          }
                          placeholder="TDM Travel Trade Excellence Awards 2026"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="opacity-70">City (optional)</span>
                        <input
                          className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
                          value={ev.city}
                          onChange={(e) =>
                            setManualEvents((prev) =>
                              prev.map((p, j) => (j === i ? { ...p, city: e.target.value } : p)),
                            )
                          }
                          placeholder="Singapore"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="opacity-70">Event page link (optional)</span>
                        <input
                          className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
                          value={ev.link}
                          onChange={(e) =>
                            setManualEvents((prev) =>
                              prev.map((p, j) => (j === i ? { ...p, link: e.target.value } : p)),
                            )
                          }
                          placeholder="https://…"
                        />
                      </label>
                      {ev.department === "awards" && (
                        <>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="opacity-70">Submissions open (optional)</span>
                            <input
                              type="date"
                              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
                              value={ev.submissionStart}
                              onChange={(e) =>
                                setManualEvents((prev) =>
                                  prev.map((p, j) =>
                                    j === i ? { ...p, submissionStart: e.target.value } : p,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="opacity-70">
                              Submissions deadline (drives the countdown)
                            </span>
                            <input
                              type="date"
                              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
                              value={ev.submissionEnd}
                              onChange={(e) =>
                                setManualEvents((prev) =>
                                  prev.map((p, j) =>
                                    j === i ? { ...p, submissionEnd: e.target.value } : p,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm col-span-2">
                            <span className="opacity-70">Contact person (optional)</span>
                            <input
                              className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent"
                              value={ev.contactPerson}
                              onChange={(e) =>
                                setManualEvents((prev) =>
                                  prev.map((p, j) =>
                                    j === i ? { ...p, contactPerson: e.target.value } : p,
                                  ),
                                )
                              }
                              placeholder="Jane Tan"
                            />
                          </label>
                        </>
                      )}
                      <label className="flex flex-col gap-1 text-sm col-span-2">
                        <span className="opacity-70">Image URL (optional)</span>
                        <input
                          className="border border-black/15 dark:border-white/15 rounded px-2 py-1 bg-transparent font-mono text-xs"
                          value={ev.image}
                          onChange={(e) =>
                            setManualEvents((prev) =>
                              prev.map((p, j) => (j === i ? { ...p, image: e.target.value } : p)),
                            )
                          }
                          placeholder="https://…"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setManualEvents((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="justify-self-start text-xs px-2 py-1 rounded border border-red-500/40 hover:bg-red-500/10"
                      >
                        Remove event
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setManualEvents((prev) => [
                        ...prev,
                        {
                          department: selectedDepts.has("awards") ? "awards" : "bizzcon",
                          title: "",
                          date: "",
                          city: "",
                          link: "",
                          image: "",
                          submissionStart: "",
                          submissionEnd: "",
                          contactPerson: "",
                        },
                      ])
                    }
                    className="self-start text-xs px-3 py-1.5 rounded border border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    + Add event
                  </button>
                </div>
                </>
                )}
              </div>
            )}
          </div>
        </details>

        <div className="flex flex-col gap-2 text-sm">
          <span className="opacity-70">Departments</span>
          <div className="flex flex-wrap gap-3">
            {departmentSlugs.length === 0 && (
              <span className="text-xs opacity-60">
                No departments defined yet — create one first.
              </span>
            )}
            {departmentSlugs.map((d) => (
              <label key={d} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedDepts.has(d)}
                  onChange={() => toggleDept(d)}
                />
                <span className="text-sm">{humanize(d)}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active
        </label>

        <button
          type="submit"
          disabled={busy}
          className="self-start rounded bg-foreground text-background px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {feedback && <p className="text-xs opacity-70">{feedback}</p>}
      </form>

      <section className="border border-red-500/20 rounded-lg p-4 flex flex-col gap-3">
        <h2 className="font-medium text-red-500">Danger zone</h2>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="self-start text-xs px-3 py-1.5 rounded border border-red-500/40 hover:bg-red-500/10 disabled:opacity-50"
        >
          Delete this publication
        </button>
      </section>
    </div>
  );
}
