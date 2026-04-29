import type { DbAdapter, DbCollection } from "./adapter";
import { createMongoAdapter } from "./mongodb";

let activePromise: Promise<DbAdapter> | null = null;

declare global {
  var _dbAdapterPromise: Promise<DbAdapter> | undefined;
}

export function getAdapter(): Promise<DbAdapter> {
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

export type { DbAdapter, DbCollection } from "./adapter";
