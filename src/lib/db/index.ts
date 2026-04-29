import type { Db } from "mongodb";
import type { DbAdapter, DbCollection } from "./adapter";
import { createMongoAdapter, MongoAdapter } from "./mongodb";

let activePromise: Promise<MongoAdapter> | null = null;

declare global {
  var _dbAdapterPromise: Promise<MongoAdapter> | undefined;
}

export function getAdapter(): Promise<MongoAdapter> {
  if (globalThis._dbAdapterPromise) return globalThis._dbAdapterPromise;
  if (activePromise) return activePromise;
  activePromise = createMongoAdapter();
  globalThis._dbAdapterPromise = activePromise;
  return activePromise;
}

export async function getCollection<T = any>(name: string): Promise<DbCollection<T>> {
  const adapter = await getAdapter();
  return adapter.getCollection<T>(name);
}

export async function getDb(): Promise<Db> {
  const adapter = await getAdapter();
  return adapter.getDb();
}

export type { DbAdapter, DbCollection } from "./adapter";
