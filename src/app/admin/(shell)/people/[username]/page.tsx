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
    departments: person.departments ?? [],
    canLogin: !!person.auth?.passwordHash,
    lastLoginAt: person.auth?.lastLoginAt ? person.auth.lastLoginAt.toISOString() : null,
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/admin/people" className="text-sm opacity-60 hover:opacity-100">
          ← People
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{person.displayName}</h1>
        <p className="text-sm opacity-60 font-mono mt-1">{person.username}</p>
      </div>
      <PersonEditor person={safe} departmentSlugs={depts.map((d) => d.slug)} />
    </div>
  );
}
