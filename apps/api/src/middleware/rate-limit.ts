import { createMiddleware } from "hono/factory";
import { env } from "../lib/env";

type Bucket = { count: number; resetAt: number };

/** In-memory rate limiter — ringan untuk single-instance VPS */
const buckets = new Map<string, Bucket>();

function cleanup() {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

// Cleanup periodik agar memory tidak bocor
setInterval(cleanup, 60_000).unref?.();

function clientKey(c: { req: { header: (n: string) => string | undefined } }, suffix: string) {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown";
  return `${ip}:${suffix}`;
}

function checkLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > max) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

export function rateLimit(opts: { max?: number; windowMs?: number; key?: string } = {}) {
  const max = opts.max ?? env.RATE_LIMIT_MAX;
  const windowMs = opts.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const suffix = opts.key ?? "global";

  return createMiddleware(async (c, next) => {
    const key = clientKey(c, suffix);
    const result = checkLimit(key, max, windowMs);
    if (!result.ok) {
      c.header("Retry-After", String(result.retryAfter));
      return c.json(
        { success: false, message: "Terlalu banyak permintaan. Coba lagi nanti." },
        429,
      );
    }
    await next();
  });
}

export const loginRateLimit = rateLimit({
  max: env.RATE_LIMIT_LOGIN_MAX,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  key: "login",
});

export const uploadRateLimit = rateLimit({
  max: env.RATE_LIMIT_UPLOAD_MAX,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  key: "upload",
});
