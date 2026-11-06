import type { AuthUser } from "../types/context";

/** TTL cache session+permission (detik) — kurangi hit DB tiap request */
const SESSION_CACHE_TTL_MS = 45_000;
const MAX_ENTRIES = 2_000;

type Entry = { user: AuthUser; expiresAt: number };

const cache = new Map<string, Entry>();

function prune() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k);
  }
  // Hard cap: buang entri paling lama jika overflow
  if (cache.size > MAX_ENTRIES) {
    const excess = cache.size - MAX_ENTRIES;
    let i = 0;
    for (const k of cache.keys()) {
      cache.delete(k);
      if (++i >= excess) break;
    }
  }
}

setInterval(prune, 60_000).unref?.();

export function getCachedSessionUser(sessionKey: string): AuthUser | null {
  const e = cache.get(sessionKey);
  if (!e) return null;
  if (e.expiresAt <= Date.now()) {
    cache.delete(sessionKey);
    return null;
  }
  return e.user;
}

export function setCachedSessionUser(sessionKey: string, user: AuthUser) {
  cache.set(sessionKey, {
    user,
    expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
  });
}

export function invalidateSessionKey(sessionKey: string) {
  cache.delete(sessionKey);
}

/** Cabut cache semua session user (setelah logout-all / ganti password / nonaktif) */
export function invalidateUserSessions(userId: number) {
  for (const [k, v] of cache) {
    if (v.user.id === userId) cache.delete(k);
  }
}

export function clearSessionCache() {
  cache.clear();
}
