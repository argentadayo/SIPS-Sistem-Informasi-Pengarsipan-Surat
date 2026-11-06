import { createMiddleware } from "hono/factory";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { hashToken } from "../lib/crypto";
import {
  getCachedSessionUser,
  setCachedSessionUser,
  invalidateSessionKey,
} from "../lib/session-cache";
import type { AuthUser } from "../types/context";
import type { PermissionName } from "@arsip/shared";

function sessionCacheKey(tokenHash: string) {
  return tokenHash.slice(0, 64);
}

async function loadUserFromSession(token: string): Promise<AuthUser | null> {
  const tokenHash = await hashToken(token);
  const key = sessionCacheKey(tokenHash);

  const cached = getCachedSessionUser(key);
  if (cached) return cached;

  const session = await db.session.findUnique({
    where: { id: key },
    include: {
      user: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } },
            },
          },
          bidang: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    invalidateSessionKey(key);
    return null;
  }
  if (session.tokenHash !== tokenHash) return null;
  if (!session.user.status) return null;

  const permissions = session.user.role.rolePermissions.map(
    (rp) => rp.permission.name as PermissionName,
  );

  const user: AuthUser = {
    id: session.user.id,
    nama: session.user.nama,
    username: session.user.username,
    email: session.user.email,
    roleId: session.user.roleId,
    roleName: session.user.role.name,
    bidangId: session.user.bidangId,
    bidangNama: session.user.bidang?.namaBidang ?? null,
    permissions,
  };

  setCachedSessionUser(key, user);
  return user;
}

export const sessionMiddleware = createMiddleware(async (c, next) => {
  const token = getCookie(c, env.COOKIE_NAME);
  if (!token) {
    c.set("user", null);
    await next();
    return;
  }
  try {
    const user = await loadUserFromSession(token);
    c.set("user", user);
  } catch {
    c.set("user", null);
  }
  await next();
});

export const requireAuth = createMiddleware(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ success: false, message: "Tidak terautentikasi" }, 401);
  }
  await next();
});

export function requirePermission(...perms: PermissionName[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, message: "Tidak terautentikasi" }, 401);
    }
    // Super Admin: akses penuh
    if (user.roleName === "Super Admin") {
      await next();
      return;
    }
    const ok = perms.some((p) => user.permissions.includes(p));
    if (!ok) {
      return c.json({ success: false, message: "Akses ditolak" }, 403);
    }
    await next();
  });
}

export function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string, expiresAt: Date) {
  setCookie(c, env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(c: Parameters<typeof deleteCookie>[0]) {
  deleteCookie(c, env.COOKIE_NAME, {
    path: "/",
    secure: env.COOKIE_SECURE,
    sameSite: "Lax",
  });
}

/** Scope data per role: Super Admin = semua, Admin Bidang = bidang sendiri */
export function bidangScope(user: AuthUser): number | null {
  if (user.roleName === "Super Admin") return null;
  return user.bidangId;
}

/** Hanya Super Admin (CRUD bidang, kode klasifikasi, sub indeks) */
export const requireSuperAdmin = createMiddleware(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ success: false, message: "Tidak terautentikasi" }, 401);
  }
  if (user.roleName !== "Super Admin") {
    return c.json(
      { success: false, message: "Hanya Super Admin yang dapat mengelola master data ini" },
      403,
    );
  }
  await next();
});

export async function sessionKeyFromToken(token: string | undefined) {
  if (!token) return null;
  const tokenHash = await hashToken(token);
  return sessionCacheKey(tokenHash);
}
