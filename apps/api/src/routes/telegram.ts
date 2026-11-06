import { Hono } from "hono";
import { env } from "../lib/env";
import { handleTelegramUpdate, isTelegramEnabled } from "../services/telegram.service";
import type { AppVariables } from "../types/context";

export const telegramRoutes = new Hono<{ Variables: AppVariables }>();

/** Webhook dari Telegram — tanpa session cookie */
telegramRoutes.post("/webhook", async (c) => {
  if (!isTelegramEnabled()) {
    return c.json({ success: false, message: "Telegram tidak dikonfigurasi" }, 503);
  }
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const secret = c.req.header("x-telegram-bot-api-secret-token");
    if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return c.json({ success: false, message: "Unauthorized" }, 401);
    }
  }
  try {
    const update = await c.req.json();
    await handleTelegramUpdate(update);
  } catch {
    // Telegram mengulang jika non-2xx; tetap 200 agar tidak flood
  }
  return c.json({ ok: true });
});
