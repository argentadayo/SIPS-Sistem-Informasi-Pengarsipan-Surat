import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { securityHeaders, requestId, originCheck } from "./middleware/security";
import { rateLimit } from "./middleware/rate-limit";
import { sessionMiddleware } from "./middleware/auth";
import { csrfMiddleware, CSRF_HEADER } from "./middleware/csrf";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes } from "./routes/dashboard";
import { suratMasukRoutes } from "./routes/surat-masuk";
import { suratKeluarRoutes } from "./routes/surat-keluar";
import { masterRoutes } from "./routes/master";
import { notificationRoutes } from "./routes/notifications";
import { telegramRoutes } from "./routes/telegram";
import { ocrRoutes } from "./routes/ocr";
import { ensureDirs } from "./services/file.service";
import { purgeExpiredSessions } from "./services/auth.service";
import type { AppVariables } from "./types/context";

const app = new Hono<{ Variables: AppVariables }>();

// ── Global middleware (security-first, light) ─────────────────────
app.use("*", requestId);
app.use("*", securityHeaders);
app.use(
  "*",
  cors({
    origin: env.WEB_URL,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-Request-Id", CSRF_HEADER, "X-CSRF-Token"],
    maxAge: 600,
  }),
);
app.use("*", rateLimit());
app.use("*", originCheck);
app.use("*", sessionMiddleware);
app.use("*", csrfMiddleware);

if (env.NODE_ENV === "development") {
  app.use("*", honoLogger());
}

// ── Health (no auth) ──────────────────────────────────────────────
app.get("/health", (c) =>
  c.json({
    success: true,
    service: "arsip-surat-api",
    runtime: "bun",
    env: env.NODE_ENV,
  }),
);

// ── Routes ────────────────────────────────────────────────────────
app.route("/api/auth", authRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/surat-masuk", suratMasukRoutes);
app.route("/api/surat-keluar", suratKeluarRoutes);
app.route("/api/master", masterRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/telegram", telegramRoutes);
app.route("/api/ocr", ocrRoutes);

app.notFound((c) => c.json({ success: false, message: "Endpoint tidak ditemukan" }, 404));

app.onError((err, c) => {
  logger.error("unhandled_error", {
    requestId: c.get("requestId"),
    error: err.message,
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
  });
  return c.json(
    {
      success: false,
      message: env.NODE_ENV === "production" ? "Terjadi kesalahan server" : err.message,
    },
    500,
  );
});

// ── Bootstrap ─────────────────────────────────────────────────────
await ensureDirs();

// Purge session expired setiap 30 menit
setInterval(() => {
  purgeExpiredSessions().catch((e) => logger.warn("purge_session_failed", { error: String(e) }));
}, 30 * 60 * 1000).unref?.();

logger.info("api_start", {
  port: env.PORT,
  web: env.WEB_URL,
  runtime: "bun",
});

export default {
  port: env.PORT,
  hostname: "0.0.0.0",
  fetch: app.fetch,
  // Batasi body agar tidak OOM di VPS kecil
  maxRequestBodySize: env.MAX_FILE_SIZE_MB * 1024 * 1024 + 1024 * 100,
};
