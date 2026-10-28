// 自前の軽量セッション認証（WebCrypto PBKDF2 + KVセッション）
// Supabase Auth の代替。事業者のみログインする小さな認証面。
import type { Env, Session } from "./types";

const SESSION_COOKIE = "sr_session";
const SESSION_TTL = 60 * 60 * 24 * 30; // 30日
const PBKDF2_ITER = 100_000;

// ---- パスワードハッシュ ----
function buf2hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function pbkdf2(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
    key,
    256
  );
  return buf2hex(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = buf2hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await pbkdf2(password, salt);
  return `${salt}$${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = (stored || "").split("$");
  if (!salt || !hash) return false;
  const calc = await pbkdf2(password, salt);
  // 定数時間比較
  if (calc.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < calc.length; i++) diff |= calc.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

// ---- Cookie ----
function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`;
}

export function clearCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// ---- セッション (KV) ----
export async function createSession(env: Env, session: Session): Promise<string> {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  await env.SESSIONS.put(`sess:${token}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  return token;
}

export async function getSession(request: Request, env: Env): Promise<Session | null> {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (!token) return null;
  const raw = await env.SESSIONS.get(`sess:${token}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function destroySession(request: Request, env: Env): Promise<void> {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (token) await env.SESSIONS.delete(`sess:${token}`);
}
