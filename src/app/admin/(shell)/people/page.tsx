import * as people from "@/lib/repos/people";
import * as departments from "@/lib/repos/departments";
import PeopleManager from "./PeopleManager";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const [rows, depts] = await Promise.all([people.listAll(), departments.listAll()]);
  // Strip the password hash before sending to the client.
  const safe = rows.map((p) => ({
    username: p.username,
    displayName: p.displayName,
    email: p.email ?? "",
    active: p.active,
    nameKeys: p.nameKeys,
    departments: p.departments ?? [],
    canLogin: !!p.auth?.passwordHash,
    lastLoginAt: p.auth?.lastLoginAt ? p.auth.lastLoginAt.toISOString() : null,
  }));
  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">People</h1>
        <p className="text-sm opacity-60 mt-1">
          Editorial team plus admins. Login is enabled by setting a password.
          Department memberships and roles live on each person.
        </p>
      </div>
      <PeopleManager
        people={safe}
        departmentSlugs={depts.map((d) => d.slug)}
      />
    </div>
  );
}
