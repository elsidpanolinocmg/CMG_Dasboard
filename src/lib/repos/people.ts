import { getDb } from "@/lib/db";
import type { Person } from "@/lib/entities";

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

export async function listActive(): Promise<Person[]> {
  return (await col()).find({ active: true }).toArray();
}

export async function listAll(): Promise<Person[]> {
  return (await col()).find({}).sort({ username: 1 }).toArray();
}

export async function upsert(person: Omit<Person, "createdAt" | "updatedAt">): Promise<void> {
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

export async function remove(username: string): Promise<void> {
  await (await col()).deleteOne({ username });
}
