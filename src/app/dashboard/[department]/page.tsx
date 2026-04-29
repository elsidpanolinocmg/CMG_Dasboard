import * as brands from "@/lib/repos/brands";
import Odometer from "@/components/Odometer";

export const dynamic = "force-dynamic";

export default async function DepartmentOverviewPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: rawDept } = await params;
  const dept = decodeURIComponent(rawDept).toLowerCase();
  const publications = await brands.findByDepartment(dept);

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      <section>
        <div className="text-xs uppercase tracking-wide opacity-60">
          Active right now across {publications.length}{" "}
          {publications.length === 1 ? "publication" : "publications"}
        </div>
        <div className="mt-2 text-6xl font-semibold tabular-nums">
          <Odometer fetchUrl="/api/all/active" intervalMs={30_000} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wide opacity-60">Publications</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {publications.length === 0 && (
            <div className="col-span-full text-sm opacity-60 border border-black/10 dark:border-white/10 rounded-lg p-6 text-center">
              No publications attached to this department yet.
            </div>
          )}
          {publications.map((b) => (
            <div
              key={b.slug}
              className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-2"
              style={
                b.color
                  ? {
                      borderTop: `3px solid ${b.color}`,
                    }
                  : undefined
              }
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-medium truncate">{b.displayName}</div>
                {b.url && (
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs opacity-50 hover:opacity-100 shrink-0"
                  >
                    ↗
                  </a>
                )}
              </div>
              {b.ga4PropertyId ? (
                <div className="text-3xl font-semibold tabular-nums">
                  <Odometer
                    fetchUrl={`/api/active-now/${encodeURIComponent(b.slug)}`}
                    intervalMs={60_000}
                  />
                </div>
              ) : (
                <div className="text-xs opacity-50">No GA4 property</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
