import { db } from "../lib/db";
import { env } from "../lib/env";
import {
  generateSessionToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "../lib/crypto";
import {
  clearLoginFailures,
  getLoginLockout,
  recordLoginFailure,
} from "../lib/login-lockout";
import {
  invalidateSessionKey,
  invalidateUserSessions,
} from "../lib/session-cache";
import { writeAudit } from "./audit.service";

export class AuthError extends Error {
  status: number;
  retryAfterSec?: number;

  constructor(message: string, status = 401, retryAfterSec?: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

export async function login(params: {
  username: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const username = params.username.trim().toLowerCase();

  const lock = getLoginLockout(username);
  if (lock.locked) {
    await writeAudit({
      action: "login_locked",
      entity: "auth",
      detail: `username=${username};retry=${lock.retryAfterSec}s`,
      ipAddress: params.ipAddress,
    });
    throw new AuthError(
      `Terlalu banyak percobaan gagal. Coba lagi dalam ${lock.retryAfterSec} detik.`,
      429,
      lock.retryAfterSec,
    );
  }

  const user = await db.user.findFirst({
    where: {
      OR: [{ username }, { email: username }],
    },
    include: { role: true },
  });

  // Constant-time-ish: selalu hash dummy jika user tidak ada
  const dummyHash = await hashPassword("invalid-login-dummy");
  const hash = user?.password ?? dummyHash;
  const valid = await verifyPassword(params.password, hash);

  if (!user || !valid || !user.status) {
    const after = recordLoginFailure(username);
    await writeAudit({
      userId: user?.id,
      action: "login_failed",
      entity: "auth",
      detail: `username=${username};fails=${after.failCount}${after.locked ? ";locked=1" : ""}`,
      ipAddress: params.ipAddress,
    });
    if (after.locked) {
      throw new AuthError(
        `Terlalu banyak percobaan gagal. Coba lagi dalam ${after.retryAfterSec} detik.`,
        429,
        after.retryAfterSec,
      );
    }
    throw new AuthError("Username atau password salah", 401);
  }

  clearLoginFailures(username);

  const token = generateSessionToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

  await db.session.create({
    data: {
      id: tokenHash.slice(0, 64),
      userId: user.id,
      tokenHash,
      ipAddress: params.ipAddress?.slice(0, 45) ?? null,
      userAgent: params.userAgent?.slice(0, 500) ?? null,
      expiresAt,
    },
  });

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAudit({
    userId: user.id,
    action: "login",
    entity: "auth",
    ipAddress: params.ipAddress,
  });

  return {
    token,
    expiresAt,
    user: {
      id: user.id,
      nama: user.nama,
      username: user.username,
      email: user.email,
      roleName: user.role.name,
    },
  };
}

export async function logout(token: string | undefined, userId?: number, ip?: string) {
  if (token) {
    const tokenHash = await hashToken(token);
    const key = tokenHash.slice(0, 64);
    await db.session.deleteMany({ where: { id: key } });
    invalidateSessionKey(key);
  }
  if (userId) {
    await writeAudit({ userId, action: "logout", entity: "auth", ipAddress: ip });
  }
}

/** Hapus semua session user (logout semua perangkat) */
export async function revokeAllSessions(params: {
  userId: number;
  actorUserId: number;
  ip?: string;
  /** Session key (id) yang tetap dipertahankan — opsional (self logout-all biasanya cabut semua) */
  keepSessionId?: string | null;
}) {
  const where = params.keepSessionId
    ? { userId: params.userId, NOT: { id: params.keepSessionId } }
    : { userId: params.userId };

  const result = await db.session.deleteMany({ where });
  invalidateUserSessions(params.userId);

  await writeAudit({
    userId: params.actorUserId,
    action: "revoke_sessions",
    entity: "user",
    entityId: params.userId,
    detail: `count=${result.count}`,
    ipAddress: params.ip,
  });

  return { count: result.count };
}

export async function purgeExpiredSessions() {
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
