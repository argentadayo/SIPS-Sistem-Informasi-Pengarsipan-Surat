/**
 * Lockout login: 7 gagal dalam window 1 menit (per username) → kunci 1 menit.
 * In-memory — cocok single-instance VPS.
 */

const FAIL_WINDOW_MS = 60_000;
const LOCKOUT_MS = 60_000;
const MAX_FAILURES = 7;

type Bucket = {
  /** Timestamp tiap gagal (ms) dalam window */
  fails: number[];
  lockedUntil: number;
};

const buckets = new Map<string, Bucket>();

function normalizeKey(username: string) {
  return username.trim().toLowerCase();
}

function pruneBucket(b: Bucket, now: number) {
  b.fails = b.fails.filter((t) => now - t < FAIL_WINDOW_MS);
  if (b.lockedUntil <= now && b.fails.length === 0) {
    return true; // empty → boleh dihapus
  }
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (pruneBucket(b, now)) buckets.delete(k);
  }
}, 60_000).unref?.();

export function getLoginLockout(username: string): {
  locked: boolean;
  retryAfterSec: number;
  failCount: number;
} {
  const key = normalizeKey(username);
  const now = Date.now();
  const b = buckets.get(key);
  if (!b) return { locked: false, retryAfterSec: 0, failCount: 0 };
  pruneBucket(b, now);
  if (b.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSec: Math.ceil((b.lockedUntil - now) / 1000),
      failCount: b.fails.length,
    };
  }
  return { locked: false, retryAfterSec: 0, failCount: b.fails.length };
}

/** Catat login gagal. Return status lockout setelah dicatat. */
export function recordLoginFailure(username: string): {
  locked: boolean;
  retryAfterSec: number;
  failCount: number;
} {
  const key = normalizeKey(username);
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { fails: [], lockedUntil: 0 };
    buckets.set(key, b);
  }
  // Sudah terkunci: jangan perpanjang counter berlebihan
  if (b.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSec: Math.ceil((b.lockedUntil - now) / 1000),
      failCount: b.fails.length,
    };
  }
  pruneBucket(b, now);
  b.fails.push(now);
  if (b.fails.length >= MAX_FAILURES) {
    b.lockedUntil = now + LOCKOUT_MS;
    return {
      locked: true,
      retryAfterSec: Math.ceil(LOCKOUT_MS / 1000),
      failCount: b.fails.length,
    };
  }
  return { locked: false, retryAfterSec: 0, failCount: b.fails.length };
}

export function clearLoginFailures(username: string) {
  buckets.delete(normalizeKey(username));
}

export const LOGIN_LOCKOUT = {
  maxFailures: MAX_FAILURES,
  windowMs: FAIL_WINDOW_MS,
  lockoutMs: LOCKOUT_MS,
} as const;
