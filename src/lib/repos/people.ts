import { getDb } from "@/lib/db";
import type {
  Person,
  PersonDepartmentMembership,
  PersonDepartmentRole,
} from "@/lib/entities";

const COLLECTION = "people";

async function col() {
  const db = await getDb();
  return db.collection<Person>(COLLECTION);
}

export async function findByUsername(username: string): Promise<Person | null> {
  return (await col()).findOne({ username });
}

export async function findByNameKey(key: string): Promise<Person | null> {
  return (await col()).findOne({ nameKeys: key });
}

export async function findByNameKeys(keys: string[]): Promise<Person[]> {
  if (keys.length === 0) return [];
  return (await col()).find({ nameKeys: { $in: keys } }).toArray();
}

export async function setNameKeys(username: string, nameKeys: string[]): Promise<void> {
  await (await col()).updateOne(
    { username },
    { $set: { nameKeys, updatedAt: new Date() } },
  );
}

export async function listActive(): Promise<Person[]> {
  return (await col()).find({ active: true }).sort({ username: 1 }).toArray();
}

export async function listAll(): Promise<Person[]> {
  return (await col()).find({}).sort({ username: 1 }).toArray();
}

export async function listByDepartment(deptSlug: string): Promise<Person[]> {
  return (await col())
    .find({ "departments.departmentSlug": deptSlug })
    .sort({ username: 1 })
    .toArray();
}

export async function listByDepartmentRole(
  deptSlug: string,
  role: PersonDepartmentRole,
): Promise<Person[]> {
  return (await col())
    .find({
      departments: {
        $elemMatch: { departmentSlug: deptSlug, role },
      },
    })
    .sort({ username: 1 })
    .toArray();
}

export async function upsert(
  person: Omit<Person, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { username: person.username },
    {
      $set: { ...person, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function setPassword(username: string, passwordHash: string): Promise<void> {
  await (await col()).updateOne(
    { username },
    { $set: { "auth.passwordHash": passwordHash, updatedAt: new Date() } },
  );
}

export async function recordLogin(username: string): Promise<void> {
  await (await col()).updateOne(
    { username },
    { $set: { "auth.lastLoginAt": new Date(), updatedAt: new Date() } },
  );
}

export async function setActive(username: string, active: boolean): Promise<void> {
  await (await col()).updateOne(
    { username },
    { $set: { active, updatedAt: new Date() } },
  );
}

export async function addDepartment(
  username: string,
  deptSlug: string,
  role: PersonDepartmentRole,
  since?: Date,
): Promise<void> {
  const now = new Date();
  const membership: PersonDepartmentMembership = {
    departmentSlug: deptSlug,
    role,
    since: since ?? now,
  };
  // Pull any existing membership for this dept first, then push the new one — replaces in place.
  await (await col()).updateOne(
    { username },
    { $pull: { departments: { departmentSlug: deptSlug } } },
  );
  await (await col()).updateOne(
    { username },
    {
      $push: { departments: membership },
      $set: { updatedAt: now },
    },
  );
}

export async function setDepartmentRole(
  username: string,
  deptSlug: string,
  role: PersonDepartmentRole,
): Promise<void> {
  await (await col()).updateOne(
    { username, "departments.departmentSlug": deptSlug },
    {
      $set: {
        "departments.$.role": role,
        updatedAt: new Date(),
      },
    },
  );
}

export async function setDepartmentProperties(
  username: string,
  deptSlug: string,
  properties: Record<string, string>,
): Promise<void> {
  await (await col()).updateOne(
    { username, "departments.departmentSlug": deptSlug },
    {
      $set: {
        "departments.$.properties": properties,
        updatedAt: new Date(),
      },
    },
  );
}

export async function removeDepartment(username: string, deptSlug: string): Promise<void> {
  await (await col()).updateOne(
    { username },
    {
      $pull: { departments: { departmentSlug: deptSlug } },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function removeDepartmentEverywhere(deptSlug: string): Promise<number> {
  const res = await (await col()).updateMany(
    { "departments.departmentSlug": deptSlug },
    {
      $pull: { departments: { departmentSlug: deptSlug } },
      $set: { updatedAt: new Date() },
    },
  );
  return res.modifiedCount ?? 0;
}

export async function remove(username: string): Promise<void> {
  await (await col()).deleteOne({ username });
}
