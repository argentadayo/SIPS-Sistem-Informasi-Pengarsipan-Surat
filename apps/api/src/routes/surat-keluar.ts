import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../lib/db";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth";
import { uploadRateLimit } from "../middleware/rate-limit";
import { PERMISSIONS, LABELS } from "@arsip/shared";
import {
  idParam,
  paginationQuery,
  exportPrintQuery,
  EXPORT_MAX_ROWS,
  PRINT_MAX_ROWS,
  parseDate,
  parseDateStart,
  parseDateEndExclusive,
  suratKeluarSchema,
  formatDate,
  formatZodError,
} from "../validators/common";
import { processUpload, getUploadAbsolutePath } from "../services/file.service";
import { writeAudit } from "../services/audit.service";
import {
  exportSuratKeluarExcel,
  exportSuratKeluarPdfHtml,
} from "../services/export.service";
import { notifySuratKeluarCreated } from "../services/notification.service";
import { assertKodeForSurat } from "../lib/klasifikasi";
import type { AppVariables } from "../types/context";
import type { Prisma } from "@prisma/client";

export const suratKeluarRoutes = new Hono<{ Variables: AppVariables }>();

const include = {
  kode: true,
  indeks: true,
  bidang: true,
  creator: { select: { id: true, nama: true } },
  updater: { select: { id: true, nama: true } },
} as const;

function mapRow(r: {
  id: number;
  noUrut: number;
  tanggalSurat: Date;
  nomorSurat: string;
  perihal: string;
  ditujukanKepada: string;
  keterangan: string | null;
  filePath: string | null;
  fileOriginalName: string | null;
  kode: { id: number; kode: string; namaKelompok: string };
  indeks: { id: number; namaIndeks: string } | null;
  bidang: { id: number; namaBidang: string };
}) {
  return {
    id: r.id,
    noUrut: r.noUrut,
    tanggalSurat: formatDate(r.tanggalSurat),
    nomorSurat: r.nomorSurat,
    kodeId: r.kode.id,
    kodeKlasifikasi: `${r.kode.kode} - ${r.kode.namaKelompok}`,
    indeksId: r.indeks?.id ?? null,
    indeks: r.indeks?.namaIndeks ?? null,
    perihal: r.perihal,
    ditujukanKepada: r.ditujukanKepada,
    bidangId: r.bidang.id,
    pembuatSurat: r.bidang.namaBidang,
    keterangan: r.keterangan,
    fileBukti: r.fileOriginalName,
    hasFile: Boolean(r.filePath),
    labels: LABELS.suratKeluar,
  };
}

function buildWhere(
  _user: NonNullable<AppVariables["user"]>,
  q: {
    search?: string;
    bidangId?: number;
    kodeId?: number;
    indeksId?: number;
    ditujukanKepada?: string;
    dari?: string;
    sampai?: string;
    dateField?: "tanggalMasukSurat" | "tanggalSurat" | "tanggalDisposisi";
  },
): Prisma.SuratKeluarWhereInput {
  // Semua role melihat semua bidang (filter bidang opsional lewat query)
  const where: Prisma.SuratKeluarWhereInput = {};
  if (q.bidangId) where.bidangId = q.bidangId;
  if (q.kodeId) where.kodeId = q.kodeId;
  if (q.indeksId) where.indeksId = q.indeksId;
  if (q.ditujukanKepada?.trim()) {
    where.ditujukanKepada = { contains: q.ditujukanKepada.trim() };
  }
  if (q.dari || q.sampai) {
    const range: Prisma.DateTimeFilter = {};
    if (q.dari) range.gte = parseDateStart(q.dari);
    // lt hari berikutnya → tanggal `sampai` ikut (inklusif)
    if (q.sampai) range.lt = parseDateEndExclusive(q.sampai);
    // Surat keluar hanya punya tanggalSurat
    where.tanggalSurat = range;
  }
  if (q.search) {
    where.OR = [
      { nomorSurat: { contains: q.search } },
      { perihal: { contains: q.search } },
      { ditujukanKepada: { contains: q.search } },
    ];
  }
  return where;
}

suratKeluarRoutes.use("*", requireAuth);

suratKeluarRoutes.get(
  "/export/excel",
  requirePermission(PERMISSIONS.SURAT_KELUAR_EXPORT),
  zValidator("query", exportPrintQuery),
  async (c) => {
    const user = c.get("user")!;
    const q = c.req.valid("query");
    const where = buildWhere(user, q);
    if (q.scope === "range") {
      const from = q.noUrutFrom;
      const to = q.noUrutTo;
      if (from != null || to != null) {
        where.noUrut = {
          ...(from != null ? { gte: from } : {}),
          ...(to != null ? { lte: to } : {}),
        };
      }
    }
    const take =
      q.scope === "page"
        ? Math.min(q.perPage, EXPORT_MAX_ROWS)
        : Math.min(q.limit ?? EXPORT_MAX_ROWS, EXPORT_MAX_ROWS);
    const skip = q.scope === "page" ? (q.page - 1) * q.perPage : 0;
    const rows = await db.suratKeluar.findMany({
      where,
      include: { kode: true, indeks: true, bidang: true },
      orderBy: { noUrut: "asc" },
      skip,
      take,
    });
    const buf = await exportSuratKeluarExcel(rows);
    await writeAudit({ userId: user.id, action: "export_excel", entity: "surat_keluar" });
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="surat-keluar.xlsx"',
      },
    });
  },
);

suratKeluarRoutes.get(
  "/export/pdf",
  requirePermission(PERMISSIONS.SURAT_KELUAR_EXPORT),
  zValidator("query", exportPrintQuery),
  async (c) => {
    const user = c.get("user")!;
    const q = c.req.valid("query");
    const where = buildWhere(user, q);
    if (q.scope === "range") {
      const from = q.noUrutFrom;
      const to = q.noUrutTo;
      if (from != null || to != null) {
        where.noUrut = {
          ...(from != null ? { gte: from } : {}),
          ...(to != null ? { lte: to } : {}),
        };
      }
    }
    const take =
      q.scope === "page"
        ? Math.min(q.perPage, PRINT_MAX_ROWS)
        : Math.min(q.limit ?? PRINT_MAX_ROWS, PRINT_MAX_ROWS);
    const skip = q.scope === "page" ? (q.page - 1) * q.perPage : 0;
    const rows = await db.suratKeluar.findMany({
      where,
      include: { kode: true, indeks: true, bidang: true },
      orderBy: { noUrut: "asc" },
      skip,
      take,
    });
    const html = exportSuratKeluarPdfHtml(rows);
    await writeAudit({ userId: user.id, action: "export_pdf", entity: "surat_keluar" });
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  },
);

suratKeluarRoutes.get(
  "/",
  requirePermission(PERMISSIONS.SURAT_KELUAR_VIEW),
  zValidator("query", paginationQuery),
  async (c) => {
    const user = c.get("user")!;
    const q = c.req.valid("query");
    const where = buildWhere(user, q);
    const skip = (q.page - 1) * q.perPage;
    const [total, rows] = await Promise.all([
      db.suratKeluar.count({ where }),
      db.suratKeluar.findMany({
        where,
        include,
        orderBy: { noUrut: "asc" },
        skip,
        take: q.perPage,
      }),
    ]);
    return c.json({
      success: true,
      data: rows.map(mapRow),
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: Math.ceil(total / q.perPage) || 1,
        labels: LABELS.suratKeluar,
      },
    });
  },
);

suratKeluarRoutes.get(
  "/:id",
  requirePermission(PERMISSIONS.SURAT_KELUAR_VIEW),
  zValidator("param", idParam),
  async (c) => {
    const { id } = c.req.valid("param");
    const row = await db.suratKeluar.findUnique({ where: { id }, include });
    if (!row) return c.json({ success: false, message: "Data tidak ditemukan" }, 404);
    return c.json({ success: true, data: mapRow(row) });
  },
);

suratKeluarRoutes.post(
  "/",
  requirePermission(PERMISSIONS.SURAT_KELUAR_CREATE),
  uploadRateLimit,
  async (c) => {
    const user = c.get("user")!;
    const contentType = c.req.header("content-type") || "";
    let body: Record<string, unknown>;
    let file: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await c.req.parseBody({ all: true });
      body = {};
      for (const [k, v] of Object.entries(form)) {
        if (k === "file" && v instanceof File) file = v;
        else if (typeof v === "string") body[k] = v;
      }
    } else {
      body = await c.req.json();
    }

    const parsed = suratKeluarSchema.safeParse(body);
    if (!parsed.success) {
      const formatted = formatZodError(parsed.error);
      return c.json(
        { success: false, message: formatted.message, errors: formatted.errors },
        422,
      );
    }
    const data = parsed.data;

    const kodeErr = await assertKodeForSurat(data.kodeId);
    if (kodeErr) {
      return c.json({ success: false, message: kodeErr }, 422);
    }

    const last = await db.suratKeluar.findFirst({ orderBy: { noUrut: "desc" } });
    const noUrut = (last?.noUrut ?? 0) + 1;

    let fileMeta: Awaited<ReturnType<typeof processUpload>> | null = null;
    if (file) {
      try {
        fileMeta = await processUpload(file);
      } catch (e) {
        return c.json(
          { success: false, message: e instanceof Error ? e.message : "Upload gagal" },
          400,
        );
      }
    }

    const created = await db.suratKeluar.create({
      data: {
        noUrut,
        tanggalSurat: parseDate(data.tanggalSurat),
        nomorSurat: data.nomorSurat,
        kodeId: data.kodeId,
        indeksId: data.indeksId ?? null,
        perihal: data.perihal,
        ditujukanKepada: data.ditujukanKepada,
        bidangId: data.bidangId,
        keterangan: data.keterangan ?? null,
        filePath: fileMeta?.filePath ?? null,
        fileOriginalName: fileMeta?.fileOriginalName ?? null,
        fileMime: fileMeta?.fileMime ?? null,
        fileSize: fileMeta?.fileSize ?? null,
        createdBy: user.id,
      },
      include,
    });

    await writeAudit({
      userId: user.id,
      action: "create",
      entity: "surat_keluar",
      entityId: created.id,
    });

    void notifySuratKeluarCreated({
      id: created.id,
      noUrut: created.noUrut,
      nomorSurat: created.nomorSurat,
      perihal: created.perihal,
      ditujukanKepada: created.ditujukanKepada,
      tanggalSurat: created.tanggalSurat,
      bidangId: created.bidangId,
      bidang: created.bidang,
      kode: created.kode,
      indeks: created.indeks,
      creator: created.creator,
      keterangan: created.keterangan,
    });

    return c.json(
      { success: true, message: "Surat keluar berhasil disimpan", data: mapRow(created) },
      201,
    );
  },
);

suratKeluarRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.SURAT_KELUAR_UPDATE),
  zValidator("param", idParam),
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const body = await c.req.json();
    const parsed = suratKeluarSchema.safeParse(body);
    if (!parsed.success) {
      const formatted = formatZodError(parsed.error);
      return c.json(
        { success: false, message: formatted.message, errors: formatted.errors },
        422,
      );
    }
    const data = parsed.data;
    const existing = await db.suratKeluar.findUnique({ where: { id } });
    if (!existing) return c.json({ success: false, message: "Data tidak ditemukan" }, 404);

    const kodeErr = await assertKodeForSurat(data.kodeId);
    if (kodeErr) {
      return c.json({ success: false, message: kodeErr }, 422);
    }

    const updated = await db.suratKeluar.update({
      where: { id },
      data: {
        tanggalSurat: parseDate(data.tanggalSurat),
        nomorSurat: data.nomorSurat,
        kodeId: data.kodeId,
        indeksId: data.indeksId ?? null,
        perihal: data.perihal,
        ditujukanKepada: data.ditujukanKepada,
        bidangId: data.bidangId,
        keterangan: data.keterangan ?? null,
        updatedBy: user.id,
      },
      include,
    });

    await writeAudit({ userId: user.id, action: "update", entity: "surat_keluar", entityId: id });
    return c.json({ success: true, message: "Berhasil diubah", data: mapRow(updated) });
  },
);

suratKeluarRoutes.delete(
  "/:id",
  requirePermission(PERMISSIONS.SURAT_KELUAR_DELETE),
  zValidator("param", idParam),
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const existing = await db.suratKeluar.findUnique({ where: { id } });
    if (!existing) return c.json({ success: false, message: "Data tidak ditemukan" }, 404);
    await db.suratKeluar.delete({ where: { id } });
    await writeAudit({
      userId: user.id,
      action: "delete",
      entity: "surat_keluar",
      entityId: id,
      detail: existing.nomorSurat,
    });
    return c.json({ success: true, message: "Berhasil dihapus" });
  },
);

suratKeluarRoutes.get(
  "/:id/file",
  requirePermission(PERMISSIONS.SURAT_KELUAR_VIEW),
  zValidator("param", idParam),
  async (c) => {
    const { id } = c.req.valid("param");
    const row = await db.suratKeluar.findUnique({ where: { id } });
    if (!row?.filePath) return c.json({ success: false, message: "File tidak ada" }, 404);
    try {
      const abs = getUploadAbsolutePath(row.filePath);
      const file = Bun.file(abs);
      if (!(await file.exists())) {
        return c.json({ success: false, message: "File hilang di storage" }, 404);
      }
      return new Response(file, {
        headers: {
          "Content-Type": row.fileMime || "application/octet-stream",
          "Content-Disposition": `inline; filename="${encodeURIComponent(row.fileOriginalName || row.filePath)}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      return c.json({ success: false, message: "File tidak valid" }, 400);
    }
  },
);
