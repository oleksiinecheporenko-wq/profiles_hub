// Signed access cookie for the optional shared-password gate (Part A, section 4).
// Token format: `<expiresAtMs>.<base64url(HMAC-SHA256(expiresAtMs))>`.
// Uses Web Crypto so it works in the proxy and in server actions alike.

export const ACCESS_COOKIE_NAME = "upm_access";
export const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

export type GateConfig =
  | { enabled: false }
  | { enabled: true; password: string; secret: string | null };

export function getGateConfig(): GateConfig {
  const password = process.env.APP_ACCESS_PASSWORD?.trim();
  if (!password) return { enabled: false };
  const secret = process.env.APP_COOKIE_SECRET?.trim() || null;
  return { enabled: true, password, secret };
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createAccessToken(secret: string, now = Date.now()): Promise<string> {
  const expiresAt = String(now + ACCESS_COOKIE_MAX_AGE_SECONDS * 1000);
  return `${expiresAt}.${await hmac(secret, expiresAt)}`;
}

export async function verifyAccessToken(
  secret: string,
  token: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const [expiresAt, signature, extra] = token.split(".");
  if (!expiresAt || !signature || extra !== undefined) return false;
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) < now) return false;
  return constantTimeEqual(signature, await hmac(secret, expiresAt));
}

/** Compares passwords without leaking length or content through timing. */
export async function passwordMatches(secret: string, given: string, expected: string) {
  const [a, b] = await Promise.all([hmac(secret, given), hmac(secret, expected)]);
  return constantTimeEqual(a, b);
}

/** Only allows same-origin relative paths as a post-login redirect target. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/profiles";
  }
  if (value.startsWith("/access") || value.includes("\\")) return "/profiles";
  return value;
}
