import * as people from "./people";
import * as departments from "./departments";
import * as brands from "./brands";
import * as dashboards from "./dashboards";
import * as externalDataSources from "./externalDataSources";
import * as dataSourceBindings from "./dataSourceBindings";
import * as adminReferences from "./adminReferences";
import * as savedReferences from "./savedReferences";
import * as pageSettings from "./pageSettings";

export interface RepoEntry {
  list(): Promise<unknown[]>;
  upsert(input: any): Promise<void>;
  remove(input: any): Promise<void>;
}

export const repoRegistry: Record<string, RepoEntry> = {
  people: {
    list: () => people.listAll(),
    upsert: (doc) => people.upsert(doc),
    remove: (input) => people.remove(input.username),
  },
  departments: {
    list: () => departments.listAll(),
    upsert: (doc) => departments.upsert(doc),
    remove: (input) => departments.remove(input.slug),
  },
  brands: {
    list: () => brands.listAll(),
    upsert: (doc) => brands.upsert(doc),
    remove: (input) => brands.remove(input.slug),
  },
  dashboards: {
    list: () => listAllDashboards(),
    upsert: (doc) => dashboards.upsert(doc),
    remove: (input) => dashboards.remove(input.departmentSlug, input.slug),
  },
  "data-sources": {
    list: () => externalDataSources.listAll(),
    upsert: (doc) => externalDataSources.upsert(doc),
    remove: (input) => externalDataSources.remove(input.kind),
  },
  bindings: {
    list: () => dataSourceBindings.listAll(),
    upsert: (doc) => dataSourceBindings.upsert(doc),
    remove: (input) =>
      dataSourceBindings.remove(
        input.departmentSlug,
        input.purpose,
        input.dataSourceKind,
      ),
  },
  "admin-references": {
    list: () => adminReferences.listAll(),
    upsert: (doc) => adminReferences.upsert(doc),
    remove: (input) => adminReferences.remove(input.id),
  },
  "saved-references": {
    list: () => savedReferences.listAll(),
    upsert: (doc) => savedReferences.upsert(doc),
    remove: (input) => savedReferences.remove(input.id),
  },
  "page-settings": {
    list: () => pageSettings.listAll(),
    upsert: (doc) => pageSettings.upsert(doc),
    remove: (input) => pageSettings.remove(input.pageKey),
  },
};

async function listAllDashboards() {
  const depts = await departments.listAll();
  const all: unknown[] = [];
  for (const d of depts) {
    const list = await dashboards.listByDepartment(d.slug);
    all.push(...list);
  }
  return all;
}

export function getRepo(name: string): RepoEntry | null {
  return repoRegistry[name] ?? null;
}
