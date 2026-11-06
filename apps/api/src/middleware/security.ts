import { createMiddleware } from "hono/factory";
import { secureHeaders } from "hono/secure-headers";
import { env } from "../lib/env";

/** Security headers — CSP ketat untuk API + protect XSS/clickjacking */
export const securityHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'none'"],
    frameAncestors: ["'none'"],
  },
  strictTransportSecurity: env.COOKIE_SECURE
    ? "max-age=31536000; includeSubDomains"
    : false,
  xFrameOptions: "DENY",
  xContentTypeOptions: "nosniff",
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
  },
});

/** Request ID untuk audit & tracing */
export const requestId = createMiddleware(async (c, next) => {
  const id = c.req.header("x-request-id") || crypto.randomUUID();
  c.set("requestId", id);
  c.header("X-Request-Id", id);
  await next();
});

/** Origin check — cegah CSRF sederhana untuk cookie session */
export const originCheck = createMiddleware(async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    await next();
    return;
  }

  // Webhook eksternal (Telegram) tidak mengirim Origin browser
  if (c.req.path.startsWith("/api/telegram/")) {
    await next();
    return;
  }

  const origin = c.req.header("origin");
  const referer = c.req.header("referer");
  const allowed = new URL(env.WEB_URL).origin;

  if (origin) {
    if (origin !== allowed && origin !== env.APP_URL) {
      return c.json({ success: false, message: "Origin tidak diizinkan" }, 403);
    }
  } else if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (refOrigin !== allowed && refOrigin !== env.APP_URL) {
        return c.json({ success: false, message: "Referer tidak diizinkan" }, 403);
      }
    } catch {
      return c.json({ success: false, message: "Referer tidak valid" }, 403);
    }
  } else if (env.NODE_ENV === "production") {
    return c.json({ success: false, message: "Origin wajib" }, 403);
  }

  await next();
});
