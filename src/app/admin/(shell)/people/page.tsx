import * as people from "@/lib/repos/people";
import PeopleManager from "./PeopleManager";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const rows = await people.listAll();
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
          Click a row to edit. Department memberships and login passwords are
          managed on the detail page.
        </p>
      </div>
      <PeopleManager people={safe} />
    </div>
  );
}
