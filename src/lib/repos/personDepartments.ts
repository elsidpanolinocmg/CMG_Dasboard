import { getDb } from "@/lib/db";
import type { PersonDepartment, PersonDepartmentRole } from "@/lib/entities";

const COLLECTION = "person_departments";

async function col() {
  const db = await getDb();
  return db.collection<PersonDepartment>(COLLECTION);
}

export async function listByDepartment(deptSlug: string): Promise<PersonDepartment[]> {
  return (await col())
    .find({ departmentSlug: deptSlug })
    .sort({ role: 1, personUsername: 1 })
    .toArray();
}

export async function listByPerson(personUsername: string): Promise<PersonDepartment[]> {
  return (await col())
    .find({ personUsername })
    .sort({ departmentSlug: 1 })
    .toArray();
}

export async function upsert(
  personUsername: string,
  departmentSlug: string,
  role: PersonDepartmentRole,
  since?: Date,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { personUsername, departmentSlug },
    {
      $set: {
        personUsername,
        departmentSlug,
        role,
        since: since ?? now,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function remove(personUsername: string, departmentSlug: string): Promise<void> {
  await (await col()).deleteOne({ personUsername, departmentSlug });
}
