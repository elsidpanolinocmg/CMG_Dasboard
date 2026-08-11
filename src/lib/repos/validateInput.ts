/**
 * Guards for the generic `/api/admin/[entity]` routes, which hand a
 * caller-supplied body straight to a repository.
 *
 * MongoDB treats objects as query operators and dotted strings as paths, so an
 * unchecked body is not merely bad data — `{"username":{"$ne":""}}` deletes an
 * arbitrary person, and `{"auth.passwordHash":"…"}` overwrites a credential the
 * form never exposes. Both are shape problems, so both are checked here rather
 * than in each route.
 */

/** Fields each entity keys its rows by. All must be plain strings. */
const IDENTIFIER_FIELDS: Record<string, string[]> = {
  people: ["username"],
  departments: ["slug"],
  brands: ["slug"],
  dashboards: ["departmentSlug", "slug"],
  "data-sources": ["kind"],
  bindings: ["departmentSlug", "purpose", "dataSourceKind"],
  "admin-references": ["id"],
  "saved-references": ["id"],
  "page-settings": ["pageKey"],
  birthdays: ["id"],
  holidays: ["date"],
};

/**
 * Fields the admin UI must never write through the generic route. `auth` holds
 * the password hash, which has its own endpoint with its own bcrypt cost, and
 * `isAdmin` is the gate on this very API — letting either through the open
 * upsert would turn any admin session into permanent ownership of every
 * account.
 */
const PROTECTED_FIELDS = new Set(["auth", "isAdmin", "_id"]);

/**
 * Rejects Mongo operator and path syntax anywhere in the document, plus any
 * protected top-level field. Returns an error message, or null when the
 * document is safe to store.
 */
export function validateDocument(
  entity: string,
  body: Record<string, unknown>,
): string | null {
  for (const field of Object.keys(body)) {
    if (PROTECTED_FIELDS.has(field)) {
      return `Field "${field}" cannot be set here`;
    }
  }
  const structural = findUnsafeKey(body, 0);
  if (structural) return structural;
  return validateIdentifiers(entity, body);
}

/**
 * Same key checks, plus a requirement that every identifier is present — a
 * delete with a missing key would otherwise match by the remaining fields, or
 * by nothing at all.
 */
export function validateDeleteInput(
  entity: string,
  body: Record<string, unknown>,
): string | null {
  const structural = findUnsafeKey(body, 0);
  if (structural) return structural;

  const fields = IDENTIFIER_FIELDS[entity];
  if (!fields) return null;
  for (const field of fields) {
    const value = body[field];
    if (typeof value !== "string" || value.trim() === "") {
      return `"${field}" must be a non-empty string`;
    }
  }
  return null;
}

/** Identifiers may be absent on upsert (some forms send partial rows), but any that appear must be strings. */
function validateIdentifiers(
  entity: string,
  body: Record<string, unknown>,
): string | null {
  const fields = IDENTIFIER_FIELDS[entity];
  if (!fields) return null;
  for (const field of fields) {
    if (field in body && typeof body[field] !== "string") {
      return `"${field}" must be a string`;
    }
  }
  return null;
}

const MAX_DEPTH = 12;

function findUnsafeKey(value: unknown, depth: number): string | null {
  if (depth > MAX_DEPTH) return "Document is nested too deeply";
  if (Array.isArray(value)) {
    for (const item of value) {
      const err = findUnsafeKey(item, depth + 1);
      if (err) return err;
    }
    return null;
  }
  if (!value || typeof value !== "object" || value instanceof Date) return null;

  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith("$")) return `Key "${key}" may not start with "$"`;
    if (key.includes(".")) return `Key "${key}" may not contain "."`;
    const err = findUnsafeKey(child, depth + 1);
    if (err) return err;
  }
  return null;
}
