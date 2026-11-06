import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getCookie } from "hono/cookie";
import { loginSchema } from "../validators/common";
import { AuthError, login, logout, revokeAllSessions } from "../services/auth.service";
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
} from "../middleware/auth";
import { clearCsrfCookie, issueCsrfToken } from "../middleware/csrf";
import { loginRateLimit } from "../middleware/rate-limit";
import { env } from "../lib/env";
import type { AppVariables } from "../types/context";

export const authRoutes = new Hono<{ Variables: AppVariables }>();

/** Public: pastikan cookie CSRF + kembalikan token untuk header X-CSRF-Token */
authRoutes.get("/csrf", (c) => {
  const token = c.get("csrfToken") || issueCsrfToken(c);
  return c.json({
    success: true,
    data: { csrfToken: token },
  });
});

authRoutes.post(
  "/login",
  loginRateLimit,
  zValidator("json", loginSchema),
  async (c) => {
    const body = c.req.valid("json");
    try {
      const result = await login({
        username: body.username,
        password: body.password,
        ipAddress: c.req.header("x-forwarded-for")?.split(",")[0] || c.req.header("x-real-ip"),
        userAgent: c.req.header("user-agent"),
      });
      setSessionCookie(c, result.token, result.expiresAt);
      // Rotasi CSRF setelah login
      const csrfToken = issueCsrfToken(c, result.expiresAt);
      c.set("csrfToken", csrfToken);
      return c.json({
        success: true,
        message: "Login berhasil",
        data: { user: result.user, csrfToken },
      });
    } catch (e) {
      if (e instanceof AuthError) {
        if (e.retryAfterSec) c.header("Retry-After", String(e.retryAfterSec));
        return c.json({ success: false, message: e.message }, e.status as 401 | 429);
      }
      return c.json(
        { success: false, message: e instanceof Error ? e.message : "Login gagal" },
        401,
      );
    }
  },
);

authRoutes.post("/logout", requireAuth, async (c) => {
  const token = getCookie(c, env.COOKIE_NAME);
  const user = c.get("user");
  await logout(
    token,
    user?.id,
    c.req.header("x-forwarded-for")?.split(",")[0] || c.req.header("x-real-ip"),
  );
  clearSessionCookie(c);
  clearCsrfCookie(c);
  // Cookie CSRF baru untuk request berikutnya (login lagi)
  const csrfToken = issueCsrfToken(c);
  c.set("csrfToken", csrfToken);
  return c.json({ success: true, message: "Logout berhasil", data: { csrfToken } });
});

/** Logout semua perangkat — hanya Super Admin (akun sendiri) */
authRoutes.post("/logout-all", requireAuth, async (c) => {
  const user = c.get("user")!;
  if (user.roleName !== "Super Admin") {
    return c.json(
      { success: false, message: "Hanya Super Admin yang dapat keluar dari semua perangkat" },
      403,
    );
  }
  const result = await revokeAllSessions({
    userId: user.id,
    actorUserId: user.id,
    ip: c.req.header("x-forwarded-for")?.split(",")[0] || c.req.header("x-real-ip"),
  });
  clearSessionCookie(c);
  clearCsrfCookie(c);
  const csrfToken = issueCsrfToken(c);
  c.set("csrfToken", csrfToken);
  return c.json({
    success: true,
    message: "Semua sesi telah diakhiri. Silakan login kembali.",
    data: { count: result.count, csrfToken },
  });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const user = c.get("user")!;
  return c.json({
    success: true,
    data: {
      id: user.id,
      nama: user.nama,
      username: user.username,
      email: user.email,
      roleName: user.roleName,
      bidangId: user.bidangId,
      bidangNama: user.bidangNama,
      permissions: user.permissions,
      csrfToken: c.get("csrfToken"),
    },
  });
});
