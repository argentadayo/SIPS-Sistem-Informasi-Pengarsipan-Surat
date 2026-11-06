import { createMiddleware } from "hono/factory";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { env } from "../lib/env";

export const CSRF_HEADER = "X-CSRF-Token";

export function csrfCookieName() {
  return `${env.COOKIE_NAME}_csrf`;
}

export function generateCsrfToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  let out = 0;
  for (let i = 0; i < ba.length; i++) out |= ba[i]! ^ bb[i]!;
  return out === 0;
}

export function setCsrfCookie(
  c: Parameters<typeof setCookie>[0],
  token: string,
  expiresAt?: Date,
) {
  const maxAgeSec = env.SESSION_TTL_HOURS * 3600;
  setCookie(c, csrfCookieName(), token, {
    // Double-submit: cookie boleh dibaca JS; proteksi utama = header harus cocok
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: "Lax",
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : { maxAge: maxAgeSec }),
  });
}

export function clearCsrfCookie(c: Parameters<typeof deleteCookie>[0]) {
  deleteCookie(c, csrfCookieName(), {
    path: "/",
    secure: env.COOKIE_SECURE,
    sameSite: "Lax",
  });
}

export function issueCsrfToken(
  c: Parameters<typeof setCookie>[0],
  expiresAt?: Date,
): string {
  const token = generateCsrfToken();
  setCsrfCookie(c, token, expiresAt);
  return token;
}

function isSafeMethod(method: string) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function isCsrfExempt(path: string) {
  // Webhook eksternal tidak punya cookie/header browser
  if (path.startsWith("/api/telegram/")) return true;
  return false;
}

/**
 * Pastikan cookie CSRF ada; validasi header pada method mutating.
 * Dipasang setelah sessionMiddleware.
 */
export const csrfMiddleware = createMiddleware(async (c, next) => {
  let token = getCookie(c, csrfCookieName())?.trim() || "";
  if (token.length < 32) {
    token = issueCsrfToken(c);
  }
  c.set("csrfToken", token);

  const method = c.req.method.toUpperCase();
  if (isSafeMethod(method) || isCsrfExempt(c.req.path)) {
    await next();
    return;
  }

  const header =
    c.req.header(CSRF_HEADER) ||
    c.req.header("x-csrf-token") ||
    c.req.header("X-Csrf-Token") ||
    "";

  if (!header || !timingSafeEqual(header, token)) {
    return c.json(
      { success: false, message: "CSRF token tidak valid atau hilang" },
      403,
    );
  }

  await next();
});
