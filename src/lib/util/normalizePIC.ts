// Strip the "Person In Charge" cell of an awards leaderboard sheet down to a
// canonical display name. Removes "c/o", parentheticals, suffix tags
// (Website Lead, LI, etc.), and trailing separators.
export function normalizePIC(raw: unknown): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  const co = s.match(/\bc\/o\s+(.+)$/i);
  if (co) s = co[1].trim();
  s = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const sepIdx = s.search(/\s*[-,/]/);
  if (sepIdx > 0) s = s.slice(0, sepIdx).trim();
  s = s.replace(/\s+(website\s+lead|web\s+lead|li\s+leads?|campaign\s+lead|past\s+winner)$/i, "").trim();
  s = s.replace(/\s+(LI|Li|PW|Leads?|Campaign|Website|Incoming|50%)$/i, "").trim();
  return s;
}
