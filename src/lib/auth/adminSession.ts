import type { NextRequest } from "next/server";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) {
    throw new Error("ADMIN_SESSION_SECRET must be set");
  }
  return s;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function asBuf(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64UrlEncodeString(s: string): string {
  return bytesToB64Url(utf8(s));
}

function b64UrlDecodeString(s: string): string {
  return new TextDecoder().decode(b64UrlToBytes(s));
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    asBuf(utf8(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, asBuf(utf8(payload)));
  return bytesToB64Url(new Uint8Array(sig));
}

async function verify(
  payload: string,
  sig: string,
  secret: string,
): Promise<boolean> {
  const key = await importKey(secret);
  const sigBuf = asBuf(b64UrlToBytes(sig));
  return crypto.subtle.verify("HMAC", key, sigBuf, asBuf(utf8(payload)));
}

export type AdminSession = { username: string; exp: number };

export async function createSessionToken(
  username: string,
): Promise<{ token: string; expiresAt: number }> {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = b64UrlEncodeString(
    JSON.stringify({ username, exp } satisfies AdminSession),
  );
  const sig = await sign(payload, getSecret());
  return { token: `${payload}.${sig}`, expiresAt: exp };
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<AdminSession | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let ok = false;
  try {
    ok = await verify(payload, sig, getSecret());
  } catch {
    return null;
  }
  if (!ok) return null;
  let parsed: AdminSession;
  try {
    parsed = JSON.parse(b64UrlDecodeString(payload)) as AdminSession;
  } catch {
    return null;
  }
  if (!parsed?.username || typeof parsed.exp !== "number") return null;
  if (Date.now() >= parsed.exp) return null;
  return parsed;
}

export async function getSessionFromRequest(
  req: NextRequest | Request,
): Promise<AdminSession | null> {
  const cookieValue =
    "cookies" in req && typeof (req as NextRequest).cookies?.get === "function"
      ? (req as NextRequest).cookies.get(COOKIE_NAME)?.value
      : parseCookieHeader(req.headers.get("cookie"))[COOKIE_NAME];
  return verifySessionToken(cookieValue);
}

function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function buildSetCookie(token: string, expiresAt: number): string {
  const expires = new Date(expiresAt).toUTCString();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}${secure}`;
}

export function buildClearCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
