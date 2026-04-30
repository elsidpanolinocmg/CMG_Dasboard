import Link from "next/link";
import { notFound } from "next/navigation";
import * as people from "@/lib/repos/people";
import * as departments from "@/lib/repos/departments";
import PersonEditor from "../PersonEditor";

export const dynamic = "force-dynamic";

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await params;
  const username = decodeURIComponent(rawUsername);
  const [person, depts] = await Promise.all([
    people.findByUsername(username),
    departments.listAll(),
  ]);
  if (!person) notFound();

  const safe = {
    username: person.username,
    displayName: person.displayName,
    email: person.email ?? "",
    active: person.active,
    nameKeys: person.nameKeys,
    departments: (person.departments ?? []).map((d) => ({
      departmentSlug: d.departmentSlug,
      role: d.role,
      since: d.since,
      properties: d.properties,
    })),
    canLogin: !!person.auth?.passwordHash,
    lastLoginAt: person.auth?.lastLoginAt ? person.auth.lastLoginAt.toISOString() : null,
  };

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
      <div>
        <Link href="/admin/people" className="text-sm opacity-60 hover:opacity-100">
          ← People
        </Link>
        <h1 className="font-semibold mt-3">{person.displayName}</h1>
        <p className="text-sm opacity-60 mt-1 font-mono">{person.username}</p>
      </div>
      <PersonEditor person={safe} departmentSlugs={depts.map((d) => d.slug)} />
    </div>
  );
}
