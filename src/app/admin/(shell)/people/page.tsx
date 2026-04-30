import * as people from "@/lib/repos/people";
import PeopleManager from "./PeopleManager";
import Hint from "../_widgets/Hint";

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
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-semibold">
          People
          <Hint>
            Click a row to edit. Department memberships and login passwords are
            managed on the detail page.
          </Hint>
        </h1>
      </div>
      <PeopleManager people={safe} />
    </div>
  );
}
