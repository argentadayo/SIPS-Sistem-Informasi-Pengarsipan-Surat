import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../lib/db";
import { requireAuth, requirePermission, requireSuperAdmin } from "../middleware/auth";
import { revokeAllSessions } from "../services/auth.service";
import { invalidateUserSessions } from "../lib/session-cache";
import { PERMISSIONS } from "@arsip/shared";
import {
  bidangSchema,
  idParam,
  masterIndeksSchema,
  masterKategoriSchema,
  masterKodeListQuery,
  masterKodeSchema,
  masterKodeSearchQuery,
  userSchema,
} from "../validators/common";
import { hashPassword } from "../lib/crypto";
import {
  assertKodeKind,
  assertKodeMatchesKategori,
  getKelompokKode,
  getKodeLevel,
  isKodeSelectableForSurat,
} from "../lib/klasifikasi";
import { writeAudit } from "../services/audit.service";
import type { AppVariables } from "../types/context";
import type { Prisma } from "@prisma/client";

export const masterRoutes = new Hono<{ Variables: AppVariables }>();

masterRoutes.use("*", requireAuth);

// ── Bidang ────────────────────────────────────────────────────────

masterRoutes.get("/bidang", requirePermission(PERMISSIONS.DASHBOARD_VIEW), async (c) => {
  const rows = await db.bidang.findMany({ orderBy: { namaBidang: "asc" } });
  return c.json({ success: true, data: rows });
});

masterRoutes.post(
  "/bidang",
  requirePermission(PERMISSIONS.MASTER_MANAGE),
  requireSuperAdmin,
  zValidator("json", bidangSchema),
  async (c) => {
    const data = c.req.valid("json");
    const row = await db.bidang.create({ data });
    await writeAudit({
      userId: c.get("user")!.id,
      action: "create",
      entity: "bidang",
      entityId: row.id,
    });
    return c.json({ success: true, data: row }, 201);
  },
);

masterRoutes.put(
  "/bidang/:id",
  requirePermission(PERMISSIONS.MASTER_MANAGE),
  requireSuperAdmin,
  zValidator("param", idParam),
  zValidator("json", bidangSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    try {
      const row = await db.bidang.update({ where: { id }, data });
      await writeAudit({
        userId: c.get("user")!.id,
        action: "update",
        entity: "bidang",
        entityId: row.id,
      });
      return c.json({ success: true, data: row });
    } catch {
      return c.json({ success: false, message: "Bidang tidak ditemukan" }, 404);
    }
  },
);

masterRoutes.delete(
  "/bidang/:id",
  requirePermission(PERMISSIONS.MASTER_MANAGE),
  requireSuperAdmin,
  zValidator("param", idParam),
  async (c) => {
    const { id } = c.req.valid("param");
    const [users, masuk, keluar] = await Promise.all([
      db.user.count({ where: { bidangId: id } }),
      db.suratMasuk.count({ where: { bidangId: id } }),
      db.suratKeluar.count({ where: { bidangId: id } }),
    ]);
    if (users > 0 || masuk > 0 || keluar > 0) {
      return c.json(
        {
          success: false,
          message: `Bidang tidak bisa dihapus karena masih dipakai (${users} user, ${masuk + keluar} surat). Nonaktifkan saja.`,
        },
        409,
      );
    }
    try {
      await db.bidang.delete({ where: { id } });
      await writeAudit({
        userId: c.get("user")!.id,
        action: "delete",
        entity: "bidang",
        entityId: id,
      });
      return c.json({ success: true, message: "Bidang dihapus" });
    } catch {
      return c.json({ success: false, message: "Gagal menghapus bidang" }, 400);
    }
  },
);

// ── Master Kategori ───────────────────────────────────────────────

masterRoutes.get("/kategori", requirePermission(PERMISSIONS.DASHBOARD_VIEW), async (c) => {
  const activeOnly = c.req.query("active") === "1";
  const rows = await db.masterKategori.findMany({
    where: activeOnly ? { status: true } : undefined,
    orderBy: { kodeAwal: "asc" },
  });
  return c.json({ success: true, data: rows });
});

masterRoutes.post(
  "/kategori",
  requirePermission(PERMISSIONS.MASTER_MANAGE),
  requireSuperAdmin,
  zValidator("json", masterKategoriSchema),
  async (c) => {
    const data = c.req.valid("json");
    try {
      const row = await db.masterKategori.create({
        data: {
          kodeAwal: data.kodeAwal,
          namaKategori: data.namaKategori,
          status: data.status,
        },
      });
      await writeAudit({
        userId: c.get("user")!.id,
        action: "create",
        entity: "master_kategori",
        entityId: row.id,
      });
      return c.json({ success: true, data: row }, 201);
    } catch {
      return c.json({ success: false, message: "Gagal menambah kategori (kode awal mungkin sudah ada)" }, 400);
    }
  },
);

masterRoutes.put(
  "/kategori/:id",
  requirePermission(PERMISSIONS.MASTER_MANAGE),
  requireSuperAdmin,
  zValidator("param", idParam),
  zValidator("json", masterKategoriSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    try {
      const row = await db.masterKategori.update({
        where: { id },
        data: {
          kodeAwal: data.kodeAwal,
          namaKategori: data.namaKategori,
          status: data.status,
        },
      });
      await writeAudit({
        userId: c.get("user")!.id,
        action: "update",
        entity: "master_kategori",
        entityId: id,
      });
      return c.json({ success: true, data: row });
    } catch {
      return c.json({ success: false, message: "Gagal update kategori" }, 400);
    }
  },
);

masterRoutes.delete(
  "/kategori/:id",
  requirePermission(PERMISSIONS.MASTER_MANAGE),
  requireSuperAdmin,
  zValidator("param", idParam),
  async (c) => {
    const { id } = c.req.valid("param");
    const used = await db.masterKode.count({ where: { kategoriId: id } });
    if (used > 0) {
      return c.json(
        {
          success: false,
          message: `Kategori masih dipakai ${used} kode/kelompok. Nonaktifkan saja atau pindahkan dulu.`,
        },
        400,
      );
    }
    try {
      await db.masterKategori.delete({ where: { id } });
      await writeAudit({
        userId: c.get("user")!.id,
        action: "delete",
        entity: "master_kategori",
        entityId: id,
      });
      return c.json({ success: true, message: "Kategori dihapus" });
    } catch {
      return c.json({ success: false, message: "Gagal menghapus kategori" }, 400);
    }
  },
);

// ── Master Kode ───────────────────────────────────────────────────

masterRoutes.get(
  "/kode/search",
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  zValidator("query", masterKodeSearchQuery),
  async (c) => {
    const q = c.req.valid("query");
    const term = q.q.trim();
    const where: Prisma.MasterKodeWhereInput = {
      ...(q.active ? { status: true } : {}),
      ...(term
        ? {
            OR: [
              { kode: { contains: term } },
              { namaKelompok: { contains: term } },
            ],
          }
        : {}),
    };
    // forSurat: ambil lebih banyak lalu filter intermediate (000.1, 000.2, …)
    const take = q.forSurat ? Math.min(q.limit * 4, 200) : q.limit;
    const rows = await db.masterKode.findMany({
      where,
      select: {
        id: true,
        kode: true,
        namaKelompok: true,
        hasSubKode: true,
        kategoriId: true,
      },
      orderBy: { kode: "asc" },
      take,
    });
    const data = q.forSurat
      ? rows.filter((r) => isKodeSelectableForSurat(r.kode)).slice(0, q.limit)
      : rows;
    return c.json({ success: true, data });
  },
);

masterRoutes.get(
  "/kode",
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  zValidator("query", masterKodeListQuery),
  async (c) => {
    const q = c.req.valid("query");
    const term = q.search.trim();
    const where: Prisma.MasterKodeWhereInput = {
      ...(q.active ? { status: true } : {}),
      ...(q.kategoriId ? { kategoriId: q.kategoriId } : {}),
      ...(term
        ? {
            OR: [
              { kode: { contains: term } },
              { namaKelompok: { contains: term } },
            ],
          }
        : {}),
    };
    const skip = (q.page - 1) * q.perPage;
    // Filter kind di app (pola titik di kode): indeks=2+, kelompok=1, all=semua
    const allRows = await db.masterKode.findMany({
      where,
      include: {
        kategori: { select: { id: true, kodeAwal: true, namaKategori: true } },
        _count: { select: { indeks: true } },
      },
      orderBy: { kode: "asc" },
    });
    const filtered =
      q.kind === "all"
        ? allRows
        : q.kind === "kelompok"
          ? allRows.filter((r) => getKodeLevel(r.kode) === "kelompok")
          : allRows.filter((r) => isKodeSelectableForSurat(r.kode));
    const total = filtered.length;
    const rows = filtered.slice(skip, skip + q.perPage);

    const parentKeys = [
      ...new Set(
        rows
          .map((r) => getKelompokKode(r.kode))
          .filter((k): k is string => Boolean(k)),
      ),
    ];
    const parents =
      parentKeys.length > 0
        ? await db.masterKode.findMany({
            where: { kode: { in: parentKeys } },
            select: { id: true, kode: true, namaKelompok: true },
          })
        : [];
    const parentByKode = new Map(parents.map((p) => [p.kode, p]));

    const data = rows.map((r) => {
      const parentKode = getKelompokKode(r.kode);
      return {
        ...r,
        kelompok: parentKode ? (parentByKode.get(parentKode) ?? null) : null,
      };
    });

    return c.json({
      success: true,
      data,
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: Math.ceil(total / q.perPage) || 1,
      },
    });
  },
);

masterRoutes.get(
  "/kode/:id",
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  zValidator("param", idParam),
  async (c) => {
    const { id } = c.req.valid("param");
    const row = await db.masterKode.findUnique({
      where: { id },
      include: {
        kategori: { select: { id: true, kodeAwal: true, namaKategori: true } },
        _count: { select: { indeks: true } },
      },
    });
    if (!row) {
      return c.json({ success: false, message: "Kode tidak ditemukan" }, 404);
    }
    return c.json({ success: true, data: row });
  },
);

masterRoutes.post(
  "/kode",
  requirePermission(PERMISSIONS.MASTER_MANAGE),
  requireSuperAdmin,
  zValidator("json", masterKodeSchema),
  async (c) => {
    const data = c.req.valid("json");
    const prefixErr = await assertKodeMatchesKategori(data.kategoriId, data.kode);
    if (prefixErr) {
      return c.json({ success: false, message: prefixErr }, 422);
    }
    const kindErr = assertKodeKind(data.kode, data.kind);
    if (kindErr) {
      return c.json({ success: false, message: kindErr }, 422);
    }
    try {
      const row = await db.masterKode.create({
        data: {
          kategoriId: data.kategoriId,
          kode: data.kode,
          namaKelompok: data.namaKelompok,
          hasSubKode: data.kind === "kelompok" ? true : data.hasSubKode,
          status: data.status,
        },
        include: { kategori: true },
      });
      await writeAudit({
        userId: c.get("user")!.id,
        action: "create",
        entity: "master_kode",
        entityId: row.id,
      });
      return c.json({ success: true, data: row }, 201);
    } catch {
      return c.json({ success: false, message: "Gagal menambah kode (mungkin kode sudah dipakai)" }, 400);
    }
  },
);

masterRoutes.put(
  "/kode/:id",
  requirePermission(PERMISSIONS.MASTER_MANAGE),
  requireSuperAdmin,
  zValidator("param", idParam),
  zValidator("json", masterKodeSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    const prefixErr = await assertKodeMatchesKategori(data.kategoriId, data.kode);
    if (prefixErr) {
      return c.json({ success: false, message: prefixErr }, 422);
    }
    const kindErr = assertKodeKind(data.kode, data.kind);
    if (kindErr) {
      return c.json({ success: false, message: kindErr }, 422);
    }
    try {
      const row = await db.masterKode.update({
        where: { id },
        data: {
          kategoriId: data.kategoriId,
          kode: data.kode,
          namaKelompok: data.namaKelompok,
          hasSubKode: data.hasSubKode,
          status: data.status,
        },
        include: { kategori: true },
      });
      await writeAudit({
        userId: c.get("user")!.id,
        action: "update",
        entity: "master_kode",
        entityId: row.id,
      });
      return c.json({ success: true, data: row });
    } catch {
      return c.json({ success: false, message: "Gagal update kode (mungkin kode sudah dipakai)" }, 400);
    }
  },
);

masterRoutes.delete(
  "/kode/:id",
  requirePermission(PERMISSIONS.MASTER_MANAGE),
  requireSuperAdmin,
  zValidator("param", idParam),
  async (c) => {
    const { id } = c.req.valid("param");
    const [masuk, keluar] = await Promise.all([
      db.suratMasuk.count({ where: { kodeId: id } }),
      db.suratKeluar.count({ where: { kodeId: id } }),
    ]);
    if (masuk > 0 || keluar > 0) {
      return c.json(
        {
          success: false,
          message: `Kode tidak bisa dihapus karena masih dipakai ${masuk + keluar} surat. Nonaktifkan saja.`,
        },
        409,
      );
    }
    try {
      await db.masterKode.delete({ where: { id } });
      await writeAudit({
        userId: c.get("user")!.id,
        action: "delete",
        entity: "master_kode",
        entityId: id,
      });
      return c.json({ success: true, message: "Kode dihapus" });
    } catch {
      return c.json({ success: false, message: "Gagal menghapus kode" }, 400);
    }
  },
);

// ── Master Indeks ─────────────────────────────────────────────────

masterRoutes.get("/indeks", requirePermission(PERMISSIONS.DASHBOARD_VIEW), async (c) => {
  const kodeId = c.req.query("kodeId");
  const activeOnly = c.req.query("active") === "1";
  if (!kodeId) {
    return c.json(
      { success: false, message: "Parameter kodeId wajib diisi" },
      422,
    );
  }
  const rows = await db.masterIndeks.findMany({
    where: {
      kodeId: Number(kodeId),
      ...(activeOnly ? { status: true } : {}),
    },
    orderBy: { urutanIndeks: "asc" },
  });
  return c.json({ success: true, data: rows });
});

async function syncHasSubKode(kodeId: number) {
  const count = await db.masterIndeks.count({ where: { kodeId, status: true } });
  await db.masterKode.update({
    where: { id: kodeId },
    data: { hasSubKode: count > 0 },
  });
}

masterRoutes.post(
  "/indeks",
  requirePermission(PERMISSIONS.MASTER_MANAGE),
  requireSuperAdmin,
  zValidator("json", masterIndeksSchema),
  async (c) => {
    const data = c.req.valid("json");
    try {
      const row = await db.masterIndeks.create({
        data: {
          kodeId: data.kodeId,
          namaIndeks: data.namaIndeks,
          urutanIndeks: data.urutanIndeks,
          status: data.status,
        },
      });
      await syncHasSubKode(data.kodeId);
      return c.json({ success: true, data: row }, 201);
    } catch {
      return c.json({ success: false, message: "Gagal menambah sub indeks (urutan mungkin duplikat)" }, 400);
    }
  },
);

masterRoutes.put(
  "/indeks/:id",
  requirePermission(PERMISSIONS.MASTER_MANAGE),
  requireSuperAdmin,
  zValidator("param", idParam),
  zValidator("json", masterIndeksSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    try {
      const prev = await db.masterIndeks.findUnique({ where: { id } });
      const row = await db.masterIndeks.update({
        where: { id },
        data: {
          kodeId: data.kodeId,
          namaIndeks: data.namaIndeks,
          urutanIndeks: data.urutanIndeks,
          status: data.status,
        },
      });
      await syncHasSubKode(data.kodeId);
      if (prev && prev.kodeId !== data.kodeId) {
        await syncHasSubKode(prev.kodeId);
      }
      await writeAudit({
        userId: c.get("user")!.id,
        action: "update",
        entity: "master_indeks",
        entityId: row.id,
      });
      return c.json({ success: true, data: row });
    } catch {
      return c.json({ success: false, message: "Gagal update sub indeks" }, 400);
    }
  },
);

masterRoutes.delete(
  "/indeks/:id",
  requirePermission(PERMISSIONS.MASTER_MANAGE),
  requireSuperAdmin,
  zValidator("param", idParam),
  async (c) => {
    const { id } = c.req.valid("param");
    const [masuk, keluar] = await Promise.all([
      db.suratMasuk.count({ where: { indeksId: id } }),
      db.suratKeluar.count({ where: { indeksId: id } }),
    ]);
    if (masuk > 0 || keluar > 0) {
      return c.json(
        {
          success: false,
          message: `Sub indeks tidak bisa dihapus karena masih dipakai ${masuk + keluar} surat. Nonaktifkan saja.`,
        },
        409,
      );
    }
    try {
      const prev = await db.masterIndeks.findUnique({ where: { id } });
      await db.masterIndeks.delete({ where: { id } });
      if (prev) await syncHasSubKode(prev.kodeId);
      await writeAudit({
        userId: c.get("user")!.id,
        action: "delete",
        entity: "master_indeks",
        entityId: id,
      });
      return c.json({ success: true, message: "Sub indeks dihapus" });
    } catch {
      return c.json({ success: false, message: "Gagal menghapus sub indeks" }, 400);
    }
  },
);

// ── Users ─────────────────────────────────────────────────────────

masterRoutes.get("/users", requirePermission(PERMISSIONS.USER_MANAGE), async (c) => {
  const rows = await db.user.findMany({
    select: {
      id: true,
      nama: true,
      username: true,
      email: true,
      status: true,
      roleId: true,
      bidangId: true,
      lastLoginAt: true,
      role: { select: { name: true } },
      bidang: { select: { namaBidang: true } },
      createdAt: true,
    },
    orderBy: { nama: "asc" },
  });
  return c.json({ success: true, data: rows });
});

masterRoutes.get("/roles", requirePermission(PERMISSIONS.USER_MANAGE), async (c) => {
  const rows = await db.role.findMany({ where: { status: true }, orderBy: { id: "asc" } });
  return c.json({ success: true, data: rows });
});

  masterRoutes.post(
  "/users",
  requirePermission(PERMISSIONS.USER_MANAGE),
  zValidator("json", userSchema),
  async (c) => {
    const data = c.req.valid("json");
    if (!data.password) {
      return c.json({ success: false, message: "Password wajib saat membuat user" }, 422);
    }
    const targetRole = await db.role.findUnique({
      where: { id: data.roleId },
      select: { name: true },
    });
    if (!targetRole) {
      return c.json({ success: false, message: "Peran tidak ditemukan" }, 422);
    }
    if (targetRole.name === "Super Admin") {
      return c.json(
        { success: false, message: "Tidak dapat menambahkan akun Super Admin" },
        403,
      );
    }
    const password = await hashPassword(data.password);
    try {
      const row = await db.user.create({
        data: {
          nama: data.nama,
          username: data.username.toLowerCase(),
          email: data.email,
          password,
          roleId: data.roleId,
          bidangId: data.bidangId ?? null,
          status: data.status,
        },
        select: {
          id: true,
          nama: true,
          username: true,
          email: true,
          roleId: true,
          bidangId: true,
          status: true,
        },
      });
      await writeAudit({
        userId: c.get("user")!.id,
        action: "create",
        entity: "user",
        entityId: row.id,
      });
      return c.json({ success: true, data: row }, 201);
    } catch {
      return c.json({ success: false, message: "Username atau email sudah dipakai" }, 409);
    }
  },
);

masterRoutes.put(
  "/users/:id",
  requirePermission(PERMISSIONS.USER_MANAGE),
  zValidator("param", idParam),
  zValidator("json", userSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");

    const existing = await db.user.findUnique({
      where: { id },
      include: { role: { select: { name: true } } },
    });
    if (!existing) {
      return c.json({ success: false, message: "User tidak ditemukan" }, 404);
    }
    if (existing.role.name === "Super Admin") {
      return c.json(
        { success: false, message: "Akun Super Admin tidak dapat diubah" },
        403,
      );
    }

    const targetRole = await db.role.findUnique({
      where: { id: data.roleId },
      select: { name: true },
    });
    if (!targetRole) {
      return c.json({ success: false, message: "Peran tidak ditemukan" }, 422);
    }
    if (targetRole.name === "Super Admin") {
      return c.json(
        { success: false, message: "Tidak dapat mengubah peran menjadi Super Admin" },
        403,
      );
    }

    const update: Record<string, unknown> = {
      nama: data.nama,
      username: data.username.toLowerCase(),
      email: data.email,
      roleId: data.roleId,
      bidangId: data.bidangId ?? null,
      status: data.status,
    };
    if (data.password) {
      update.password = await hashPassword(data.password);
    }
    try {
      const row = await db.user.update({
        where: { id },
        data: update,
        select: {
          id: true,
          nama: true,
          username: true,
          email: true,
          roleId: true,
          bidangId: true,
          status: true,
        },
      });
      // Password diganti / status nonaktif / role berubah → cabut semua sesi
      if (data.password || data.status === false || data.roleId !== existing.roleId) {
        await revokeAllSessions({
          userId: id,
          actorUserId: c.get("user")!.id,
          ip: c.req.header("x-forwarded-for")?.split(",")[0] || c.req.header("x-real-ip"),
        });
      } else {
        invalidateUserSessions(id);
      }
      await writeAudit({
        userId: c.get("user")!.id,
        action: "update",
        entity: "user",
        entityId: row.id,
      });
      return c.json({ success: true, data: row });
    } catch {
      return c.json({ success: false, message: "Gagal update user" }, 400);
    }
  },
);

/** Cabut semua sesi login user (logout semua perangkat) — Super Admin / user.manage */
masterRoutes.post(
  "/users/:id/revoke-sessions",
  requirePermission(PERMISSIONS.USER_MANAGE),
  zValidator("param", idParam),
  async (c) => {
    const { id } = c.req.valid("param");
    const actor = c.get("user")!;
    const existing = await db.user.findUnique({
      where: { id },
      include: { role: { select: { name: true } } },
    });
    if (!existing) {
      return c.json({ success: false, message: "User tidak ditemukan" }, 404);
    }
    if (existing.role.name === "Super Admin" && actor.id !== id) {
      return c.json(
        { success: false, message: "Tidak dapat mencabut sesi Super Admin lain" },
        403,
      );
    }
    const result = await revokeAllSessions({
      userId: id,
      actorUserId: actor.id,
      ip: c.req.header("x-forwarded-for")?.split(",")[0] || c.req.header("x-real-ip"),
    });
    return c.json({
      success: true,
      message: `${result.count} sesi diakhiri`,
      data: { count: result.count },
    });
  },
);

masterRoutes.delete(
  "/users/:id",
  requirePermission(PERMISSIONS.USER_MANAGE),
  zValidator("param", idParam),
  async (c) => {
    const { id } = c.req.valid("param");
    const actor = c.get("user")!;
    if (actor.id === id) {
      return c.json({ success: false, message: "Tidak bisa menghapus akun sendiri" }, 403);
    }
    const existing = await db.user.findUnique({
      where: { id },
      include: { role: { select: { name: true } } },
    });
    if (!existing) {
      return c.json({ success: false, message: "User tidak ditemukan" }, 404);
    }
    if (existing.role.name === "Super Admin") {
      return c.json(
        { success: false, message: "Akun Super Admin tidak dapat dihapus" },
        403,
      );
    }
    try {
      await revokeAllSessions({
        userId: id,
        actorUserId: actor.id,
        ip: c.req.header("x-forwarded-for")?.split(",")[0] || c.req.header("x-real-ip"),
      });
      await db.user.delete({ where: { id } });
      await writeAudit({
        userId: actor.id,
        action: "delete",
        entity: "user",
        entityId: id,
      });
      return c.json({ success: true, message: "User dihapus" });
    } catch {
      return c.json(
        {
          success: false,
          message: "Gagal menghapus user (mungkin masih terikat data surat). Nonaktifkan saja.",
        },
        409,
      );
    }
  },
);
