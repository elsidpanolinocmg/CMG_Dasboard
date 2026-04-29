import Link from "next/link";
import { notFound } from "next/navigation";
import * as departments from "@/lib/repos/departments";
import * as people from "@/lib/repos/people";
import * as brands from "@/lib/repos/brands";
import { humanize } from "@/lib/util/format";
import DepartmentEditor from "./DepartmentEditor";

export const dynamic = "force-dynamic";

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const dept = await departments.findBySlug(slug);
  if (!dept) notFound();

  const [team, publications] = await Promise.all([
    people.listByDepartment(slug),
    brands.findByDepartment(slug),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <Link href="/admin/departments" className="text-sm opacity-60 hover:opacity-100">
          ← Departments
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{dept.displayName}</h1>
      </div>

      <DepartmentEditor
        slug={dept.slug}
        displayName={dept.displayName}
        routePrefix={dept.routePrefix}
        order={dept.order}
        enabled={dept.enabled}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Team</h2>
          <span className="text-xs opacity-60">{team.length} {team.length === 1 ? "person" : "people"}</span>
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
          {team.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm opacity-60">
              No one is in this department yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/5">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Username</th>
                  <th className="px-3 py-2 font-medium">Display name</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {team.map((p) => {
                  const membership = p.departments?.find((d) => d.departmentSlug === slug);
                  return (
                    <tr
                      key={p.username}
                      className="border-t border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link
                          href={`/admin/people/${encodeURIComponent(p.username)}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {p.username}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{p.displayName}</td>
                      <td className="px-3 py-2 text-xs">
                        {membership ? humanize(membership.role) : ""}
                      </td>
                      <td className="px-3 py-2">{p.active ? "yes" : "no"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Publications</h2>
          <span className="text-xs opacity-60">{publications.length}</span>
        </div>
        <div className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
          {publications.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm opacity-60">
              No publications attached to this department.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/5">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Display name</th>
                  <th className="px-3 py-2 font-medium">URL</th>
                  <th className="px-3 py-2 font-medium">Color</th>
                  <th className="px-3 py-2 font-medium">GA4 property</th>
                </tr>
              </thead>
              <tbody>
                {publications.map((b) => (
                  <tr
                    key={b.slug}
                    className="border-t border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/brands/${encodeURIComponent(b.slug)}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {b.displayName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs opacity-70 truncate max-w-[200px]">
                      {b.url ? (
                        <a
                          href={b.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {b.url.replace(/^https?:\/\//, "")}
                        </a>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {b.color ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block w-3 h-3 rounded-sm border border-black/10 dark:border-white/10"
                            style={{ backgroundColor: b.color }}
                          />
                          <span className="font-mono opacity-70">{b.color}</span>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs opacity-70">
                      {b.ga4PropertyId ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
