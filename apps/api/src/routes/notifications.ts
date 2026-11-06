import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../lib/db";
import { requireAuth } from "../middleware/auth";
import {
  createTelegramLinkCode,
  getTelegramStatus,
  unlinkTelegram,
} from "../services/telegram.service";
import type { AppVariables } from "../types/context";

export const notificationRoutes = new Hono<{ Variables: AppVariables }>();

notificationRoutes.use("*", requireAuth);

const TG_BLOCKED = { success: false, message: "Super Admin menerima notifikasi in-app saja" };

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
  unread: z
    .enum(["0", "1"])
    .optional()
    .transform((v) => v === "1"),
});

notificationRoutes.get("/", zValidator("query", listQuery), async (c) => {
  const user = c.get("user")!;
  const q = c.req.valid("query");
  const where = {
    userId: user.id,
    ...(q.unread ? { readAt: null } : {}),
  };
  const skip = (q.page - 1) * q.perPage;
  const [total, rows] = await Promise.all([
    db.notification.count({ where }),
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: q.perPage,
    }),
  ]);
  return c.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      entity: r.entity,
      entityId: r.entityId,
      bidangId: r.bidangId,
      readAt: r.readAt,
      createdAt: r.createdAt,
    })),
    meta: {
      page: q.page,
      perPage: q.perPage,
      total,
      totalPages: Math.ceil(total / q.perPage) || 1,
    },
  });
});

notificationRoutes.get("/unread-count", async (c) => {
  const user = c.get("user")!;
  const count = await db.notification.count({
    where: { userId: user.id, readAt: null },
  });
  return c.json({ success: true, data: { count } });
});

notificationRoutes.post("/read-all", async (c) => {
  const user = c.get("user")!;
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return c.json({ success: true, message: "Semua notifikasi ditandai dibaca" });
});

notificationRoutes.get("/telegram/status", async (c) => {
  const user = c.get("user")!;
  if (user.roleName === "Super Admin") return c.json(TG_BLOCKED, 403);
  const status = await getTelegramStatus(user.id);
  return c.json({ success: true, data: status });
});

notificationRoutes.post("/telegram/link", async (c) => {
  const user = c.get("user")!;
  if (user.roleName === "Super Admin") return c.json(TG_BLOCKED, 403);
  const result = await createTelegramLinkCode(user.id);
  return c.json({
    success: true,
    data: {
      code: result.code,
      expiresAt: result.expiresAt.toISOString(),
      botUsername: result.botUsername,
      instruction: result.botUsername
        ? `Buka @${result.botUsername} lalu kirim: /link ${result.code}`
        : `Kirim ke bot: /link ${result.code}`,
    },
  });
});

notificationRoutes.post("/telegram/unlink", async (c) => {
  const user = c.get("user")!;
  if (user.roleName === "Super Admin") return c.json(TG_BLOCKED, 403);
  await unlinkTelegram(user.id);
  return c.json({ success: true, message: "Telegram dilepas" });
});

notificationRoutes.post(
  "/:id/read",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const row = await db.notification.findFirst({
      where: { id, userId: user.id },
    });
    if (!row) {
      return c.json({ success: false, message: "Notifikasi tidak ditemukan" }, 404);
    }
    if (!row.readAt) {
      await db.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }
    return c.json({ success: true });
  },
);
