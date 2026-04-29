import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { MongoClient, type Db } from "mongodb";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const DRY_RUN = process.argv.includes("--dry-run");

interface Counts { [k: string]: number }

function nowDate(): Date { return new Date(); }

function normalizeKey(raw: string): string {
  if (!raw) return "";
  const lower = raw.trim().toLowerCase();
  const local = lower.includes("@") ? lower.split("@")[0] : lower;
  return local.replace(/[\s._-]+/g, "");
}

interface SeedBrandProps {
  [slug: string]: {
    name: string;
    image?: string;
    group?: string;
    ga4_filter?: unknown;
  };
}
interface SeedGa4Props { [slug: string]: string }
interface SeedGroups { [slug: string]: { name: string; main?: string } }

function readSeedJson<T>(name: string): T {
  const path = resolve(process.cwd(), "data/seed", name);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const HARDCODED_DEPARTMENTS = [
  { slug: "editorial", displayName: "Editorial", routePrefix: "/dashboard/editorial", order: 1, enabled: true },
  { slug: "awards", displayName: "Awards", routePrefix: "/dashboard/awards", order: 2, enabled: true },
  { slug: "bizzcon", displayName: "Bizzcon", routePrefix: "/dashboard/bizzcon", order: 3, enabled: true },
];

const HARDCODED_DASHBOARDS: { departmentSlug: string; slug: string; routePath: string; order: number; enabled: boolean }[] = [
  { departmentSlug: "editorial", slug: "overview", routePath: "/dashboard/editorial", order: 1, enabled: true },
  { departmentSlug: "editorial", slug: "videos", routePath: "/dashboard/editorial/videos", order: 2, enabled: true },
  { departmentSlug: "editorial", slug: "shorts", routePath: "/dashboard/editorial/shorts", order: 3, enabled: true },
  { departmentSlug: "editorial", slug: "leaderboard", routePath: "/dashboard/editorial/leaderboard", order: 4, enabled: true },
  { departmentSlug: "awards", slug: "overview", routePath: "/dashboard/awards", order: 1, enabled: true },
  { departmentSlug: "awards", slug: "videos", routePath: "/dashboard/awards/videos", order: 2, enabled: true },
  { departmentSlug: "awards", slug: "shorts", routePath: "/dashboard/awards/shorts", order: 3, enabled: true },
  { departmentSlug: "awards", slug: "leaderboard", routePath: "/dashboard/awards/leaderboard", order: 4, enabled: true },
  { departmentSlug: "bizzcon", slug: "overview", routePath: "/dashboard/bizzcon", order: 1, enabled: true },
  { departmentSlug: "bizzcon", slug: "videos", routePath: "/dashboard/bizzcon/videos", order: 2, enabled: true },
  { departmentSlug: "bizzcon", slug: "shorts", routePath: "/dashboard/bizzcon/shorts", order: 3, enabled: true },
  { departmentSlug: "bizzcon", slug: "leaderboard", routePath: "/dashboard/bizzcon/leaderboard", order: 4, enabled: true },
  { departmentSlug: "bizzcon", slug: "sponsorship", routePath: "/dashboard/bizzcon/sponsorship", order: 5, enabled: true },
];

const HARDCODED_SOURCES = [
  { kind: "ga4", displayName: "Google Analytics 4", credentialRef: "GOOGLE_SERVICE_ACCOUNT_JSON" },
  { kind: "vimeo", displayName: "Vimeo", credentialRef: "VIMEO_ACCESS_TOKEN" },
  { kind: "google_sheets", displayName: "Google Sheets", credentialRef: "GOOGLE_OAUTH_REFRESH_TOKEN" },
  { kind: "drupal_jsonapi", displayName: "Drupal JSON:API", credentialRef: "(public)" },
];

const AWARDS_SHEET_ID = "1XaCvMWBcCgAsDByoWJE-ru3fv0K23U7rxI87_vFNWcE";
const BIZZCON_SHEET_ID = "1QgONEKtOeeE12ts5maQlMfAlnee1qxi7O-E8zhtJjxY";

const HARDCODED_BINDINGS = [
  { departmentSlug: "editorial", purpose: "analytics", dataSourceKind: "ga4", config: {} },
  { departmentSlug: "editorial", purpose: "media", dataSourceKind: "vimeo", config: { tag: "editorial" } },
  { departmentSlug: "editorial", purpose: "content", dataSourceKind: "drupal_jsonapi", config: {} },
  { departmentSlug: "awards", purpose: "analytics", dataSourceKind: "ga4", config: {} },
  { departmentSlug: "awards", purpose: "media", dataSourceKind: "vimeo", config: { tag: "awards" } },
  { departmentSlug: "awards", purpose: "leaderboard", dataSourceKind: "google_sheets",
    config: { spreadsheetId: AWARDS_SHEET_ID, sheetName: "Awards Leaderboard", range: "!A1:E2000" } },
  { departmentSlug: "bizzcon", purpose: "analytics", dataSourceKind: "ga4", config: {} },
  { departmentSlug: "bizzcon", purpose: "media", dataSourceKind: "vimeo", config: { tag: "bizzcon" } },
  { departmentSlug: "bizzcon", purpose: "leaderboard", dataSourceKind: "google_sheets",
    config: { spreadsheetId: BIZZCON_SHEET_ID, gid: 124466268 } },
];

async function fetchOldDoc<T>(oldDb: Db, uid: string): Promise<T | null> {
  const doc = await oldDb.collection("dashboard-config").findOne({ uid });
  if (!doc) return null;
  return doc as unknown as T;
}

async function importPeople(oldDb: Db, newDb: Db, counts: Counts) {
  const adminUsers = await oldDb.collection("admin-users").find({}).toArray();
  const rosterDoc = await fetchOldDoc<{ data?: { name?: string; role?: string; username?: string }[] }>(
    oldDb, "editorial-roster",
  );
  const rosterRows = rosterDoc?.data ?? [];

  const byUsername = new Map<string, {
    username: string;
    displayName: string;
    email?: string;
    active: boolean;
    nameKeys: string[];
    departments: { departmentSlug: string; role: string; since: Date }[];
    auth?: { passwordHash: string };
  }>();

  for (const u of adminUsers) {
    const username = String(u.username ?? "").trim();
    if (!username) continue;
    byUsername.set(username, {
      username,
      displayName: String(u.displayName ?? username),
      active: u.active !== false,
      nameKeys: Array.from(new Set([normalizeKey(username), normalizeKey(String(u.displayName ?? ""))].filter(Boolean))),
      departments: [],
      auth: u.passwordHash ? { passwordHash: String(u.passwordHash) } : undefined,
    });
  }

  for (const r of rosterRows) {
    const username = String(r.username ?? "").trim();
    const name = String(r.name ?? "").trim();
    const role = String(r.role ?? "").trim().toLowerCase().replace(/\s+/g, "_") || "viewer";
    const validRoles = ["managing_editor", "editor", "reporter", "admin", "viewer"];
    const safeRole = validRoles.includes(role) ? role : "viewer";
    const key = username || name || "";
    if (!key) continue;
    const ukey = (username || normalizeKey(name)) as string;
    const existing = byUsername.get(ukey);
    const nameKeys = Array.from(new Set([normalizeKey(username), normalizeKey(name)].filter(Boolean)));
    if (existing) {
      existing.displayName = existing.displayName || name || username;
      existing.nameKeys = Array.from(new Set([...existing.nameKeys, ...nameKeys]));
      const has = existing.departments.find((d) => d.departmentSlug === "editorial");
      if (!has) {
        existing.departments.push({ departmentSlug: "editorial", role: safeRole, since: nowDate() });
      }
    } else {
      byUsername.set(ukey, {
        username: ukey,
        displayName: name || username,
        active: true,
        nameKeys,
        departments: [{ departmentSlug: "editorial", role: safeRole, since: nowDate() }],
      });
    }
  }

  if (DRY_RUN) {
    counts.people = byUsername.size;
    return;
  }

  const peopleCol = newDb.collection("people");
  let n = 0;
  for (const p of byUsername.values()) {
    const now = nowDate();
    await peopleCol.updateOne(
      { username: p.username },
      {
        $set: {
          username: p.username,
          displayName: p.displayName,
          active: p.active,
          nameKeys: p.nameKeys,
          departments: p.departments,
          ...(p.auth ? { auth: p.auth } : {}),
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    n++;
  }
  counts.people = n;
}

async function importBrandsAndGroups(oldDb: Db, newDb: Db, counts: Counts) {
  const seedBrands = readSeedJson<SeedBrandProps>("brand_properties.json");
  const seedGa4 = readSeedJson<SeedGa4Props>("brand_ga4_properties.json");
  const seedGroups = readSeedJson<SeedGroups>("groups.json");

  type RuntimeBrandRow = {
    slug: string;
    name?: string;
    image?: string;
    group?: string;
    drupalDomain?: string;
    ga4FilterId?: string;
    ga4PropertyId?: string;
    editorial?: boolean;
    awards?: boolean;
    events?: boolean;
  };

  const runtimeDoc = await fetchOldDoc<{ data?: unknown }>(oldDb, "brand-all-properties");
  const runtimeRows: RuntimeBrandRow[] = (() => {
    const d = runtimeDoc?.data;
    if (Array.isArray(d)) return d as RuntimeBrandRow[];
    if (d && typeof d === "object") {
      // shape: { [slug]: { ...fields } }
      return Object.entries(d as Record<string, Record<string, unknown>>).map(
        ([slug, val]) => ({ slug, ...(val as Record<string, unknown>) }) as RuntimeBrandRow,
      );
    }
    return [];
  })();
  const runtimeBySlug = new Map(runtimeRows.map((r) => [r.slug, r]));

  // Brand groups
  if (!DRY_RUN) {
    const groupsCol = newDb.collection("brand_groups");
    let gn = 0;
    for (const [slug, g] of Object.entries(seedGroups)) {
      if (slug === "default") continue;
      const now = nowDate();
      await groupsCol.updateOne(
        { slug },
        { $set: { slug, displayName: g.name, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      gn++;
    }
    counts.brand_groups = gn;
  } else {
    counts.brand_groups = Object.keys(seedGroups).filter((k) => k !== "default").length;
  }

  // Brands
  const brandsCol = newDb.collection("brands");
  const deptBrandsCol = newDb.collection("department_brands");
  let bn = 0;
  let dbn = 0;
  for (const [slug, props] of Object.entries(seedBrands)) {
    const runtime = runtimeBySlug.get(slug);
    const ga4PropertyId = runtime?.ga4PropertyId || seedGa4[slug];
    const groupSlug = runtime?.group || props.group;
    const drupalDomain = runtime?.drupalDomain;
    const ga4FilterId = runtime?.ga4FilterId;
    const active = true;
    const displayName = runtime?.name || props.name;
    const image = runtime?.image || props.image;

    if (!DRY_RUN) {
      const now = nowDate();
      await brandsCol.updateOne(
        { slug },
        {
          $set: {
            slug,
            displayName,
            ...(image ? { image } : {}),
            ...(groupSlug && groupSlug !== "default" ? { groupSlug } : {}),
            ...(ga4PropertyId ? { ga4PropertyId } : {}),
            ...(ga4FilterId ? { ga4FilterId } : {}),
            ...(drupalDomain ? { drupalDomain } : {}),
            active,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
    }
    bn++;

    // department_brands from runtime flags
    const flags: Record<string, boolean | undefined> = {
      editorial: runtime?.editorial,
      awards: runtime?.awards,
      bizzcon: runtime?.events,
    };
    for (const [deptSlug, enabled] of Object.entries(flags)) {
      if (enabled !== true) continue;
      if (!DRY_RUN) {
        const nowL = nowDate();
        await deptBrandsCol.updateOne(
          { departmentSlug: deptSlug, brandSlug: slug },
          {
            $set: { departmentSlug: deptSlug, brandSlug: slug, enabled: true, updatedAt: nowL },
            $setOnInsert: { createdAt: nowL },
          },
          { upsert: true },
        );
      }
      dbn++;
    }
  }
  counts.brands = bn;
  counts.department_brands = dbn;
}

async function importHardcoded(newDb: Db, counts: Counts) {
  if (DRY_RUN) {
    counts.departments = HARDCODED_DEPARTMENTS.length;
    counts.dashboards = HARDCODED_DASHBOARDS.length;
    counts.external_data_sources = HARDCODED_SOURCES.length;
    counts.data_source_bindings = HARDCODED_BINDINGS.length;
    return;
  }

  const deptCol = newDb.collection("departments");
  for (const d of HARDCODED_DEPARTMENTS) {
    const now = nowDate();
    await deptCol.updateOne(
      { slug: d.slug },
      { $set: { ...d, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }
  counts.departments = HARDCODED_DEPARTMENTS.length;

  const dashCol = newDb.collection("dashboards");
  for (const dash of HARDCODED_DASHBOARDS) {
    const now = nowDate();
    await dashCol.updateOne(
      { departmentSlug: dash.departmentSlug, slug: dash.slug },
      { $set: { ...dash, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }
  counts.dashboards = HARDCODED_DASHBOARDS.length;

  const srcCol = newDb.collection("external_data_sources");
  for (const s of HARDCODED_SOURCES) {
    const now = nowDate();
    await srcCol.updateOne(
      { kind: s.kind },
      { $set: { ...s, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }
  counts.external_data_sources = HARDCODED_SOURCES.length;

  const bindCol = newDb.collection("data_source_bindings");
  for (const b of HARDCODED_BINDINGS) {
    const now = nowDate();
    await bindCol.updateOne(
      { departmentSlug: b.departmentSlug, purpose: b.purpose, dataSourceKind: b.dataSourceKind },
      { $set: { ...b, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }
  counts.data_source_bindings = HARDCODED_BINDINGS.length;
}

async function importReferences(oldDb: Db, newDb: Db, counts: Counts) {
  const adminRefs = await fetchOldDoc<{ data?: { id?: string; label?: string; href?: string; description?: string; order?: number }[] }>(
    oldDb, "admin-references",
  );
  const savedRefs = await fetchOldDoc<{ data?: { id?: string; label?: string; spreadsheetId?: string; sheetName?: string; description?: string }[] }>(
    oldDb, "saved-references",
  );

  let an = 0;
  if (adminRefs?.data && !DRY_RUN) {
    const col = newDb.collection("admin_references");
    for (const [i, r] of adminRefs.data.entries()) {
      if (!r.id || !r.label || !r.href) continue;
      const now = nowDate();
      await col.updateOne(
        { id: r.id },
        {
          $set: {
            id: r.id,
            label: r.label,
            href: r.href,
            description: r.description,
            order: typeof r.order === "number" ? r.order : i,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
      an++;
    }
  } else if (adminRefs?.data) {
    an = adminRefs.data.length;
  }
  counts.admin_references = an;

  let sn = 0;
  if (savedRefs?.data && !DRY_RUN) {
    const col = newDb.collection("saved_references");
    for (const r of savedRefs.data) {
      if (!r.id || !r.label || !r.spreadsheetId) continue;
      const now = nowDate();
      await col.updateOne(
        { id: r.id },
        {
          $set: {
            id: r.id,
            label: r.label,
            spreadsheetId: r.spreadsheetId,
            sheetName: r.sheetName,
            description: r.description,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
      sn++;
    }
  } else if (savedRefs?.data) {
    sn = savedRefs.data.length;
  }
  counts.saved_references = sn;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const oldDbName = process.env.MONGODB_DB_OLD || "cmg_db";
  const newDbName = process.env.MONGODB_DB || "cmg";
  if (!uri) {
    console.error("MONGODB_URI must be set");
    process.exit(1);
  }
  if (oldDbName === newDbName) {
    console.error(`Refusing to import: source and target db are the same (${newDbName})`);
    process.exit(1);
  }

  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Source: ${oldDbName} -> Target: ${newDbName}`);

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const oldDb = client.db(oldDbName);
    const newDb = client.db(newDbName);
    const counts: Counts = {};

    await importHardcoded(newDb, counts);
    await importBrandsAndGroups(oldDb, newDb, counts);
    await importPeople(oldDb, newDb, counts);
    await importReferences(oldDb, newDb, counts);

    console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Counts:`);
    for (const [k, v] of Object.entries(counts).sort()) {
      console.log(`  ${k}: ${v}`);
    }
    if (DRY_RUN) console.log("(No writes performed.)");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
