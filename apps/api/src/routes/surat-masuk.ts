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
  suratMasukSchema,
  formatDate,
  formatZodError,
} from "../validators/common";
import { processUpload, getUploadAbsolutePath } from "../services/file.service";
import { writeAudit } from "../services/audit.service";
import {
  exportSuratMasukExcel,
  exportSuratMasukPdfHtml,
} from "../services/export.service";
import {
  notifyDisposisiChanged,
  notifySuratMasukCreated,
} from "../services/notification.service";
import { assertKodeForSurat } from "../lib/klasifikasi";
import type { AppVariables } from "../types/context";
import type { Prisma } from "@prisma/client";

export const suratMasukRoutes = new Hono<{ Variables: AppVariables }>();

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
  tanggalMasukSurat: Date;
  asalSurat: string;
  tanggalSurat: Date;
  nomorSurat: string;
  perihal: string;
  tanggalDisposisi: Date | null;
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
    tanggalMasukSurat: formatDate(r.tanggalMasukSurat),
    asalSurat: r.asalSurat,
    tanggalSurat: formatDate(r.tanggalSurat),
    nomorSurat: r.nomorSurat,
    kodeId: r.kode.id,
    kodeKlasifikasi: `${r.kode.kode} - ${r.kode.namaKelompok}`,
    indeksId: r.indeks?.id ?? null,
    indeks: r.indeks?.namaIndeks ?? null,
    perihal: r.perihal,
    bidangId: r.bidang.id,
    disposisi: r.bidang.namaBidang,
    tanggalDisposisi: formatDate(r.tanggalDisposisi),
    keterangan: r.keterangan,
    fileBukti: r.fileOriginalName,
    hasFile: Boolean(r.filePath),
    labels: LABELS.suratMasuk,
  };
}

function buildWhere(
  _user: NonNullable<AppVariables["user"]>,
  q: {
    search?: string;
    bidangId?: number;
    kodeId?: number;
    indeksId?: number;
    asalSurat?: string;
    dari?: string;
    sampai?: string;
    dateField?: "tanggalMasukSurat" | "tanggalSurat" | "tanggalDisposisi";
  },
): Prisma.SuratMasukWhereInput {
  // Semua role melihat semua bidang (filter bidang opsional lewat query)
  const where: Prisma.SuratMasukWhereInput = {};
  if (q.bidangId) where.bidangId = q.bidangId;
  if (q.kodeId) where.kodeId = q.kodeId;
  if (q.indeksId) where.indeksId = q.indeksId;
  if (q.asalSurat?.trim()) where.asalSurat = { contains: q.asalSurat.trim() };
  if (q.dari || q.sampai) {
    const field = q.dateField ?? "tanggalMasukSurat";
    const range: Prisma.DateTimeFilter = {};
    if (q.dari) range.gte = parseDateStart(q.dari);
    // lt hari berikutnya → tanggal `sampai` ikut (inklusif)
    if (q.sampai) range.lt = parseDateEndExclusive(q.sampai);
    if (field === "tanggalSurat") where.tanggalSurat = range;
    else if (field === "tanggalDisposisi") where.tanggalDisposisi = range;
    else where.tanggalMasukSurat = range;
  }
  if (q.search) {
    where.OR = [
      { nomorSurat: { contains: q.search } },
      { perihal: { contains: q.search } },
      { asalSurat: { contains: q.search } },
    ];
  }
  return where;
}

suratMasukRoutes.use("*", requireAuth);

// Export routes HARUS sebelum /:id agar tidak tertangkap param
suratMasukRoutes.get(
  "/export/excel",
  requirePermission(PERMISSIONS.SURAT_MASUK_EXPORT),
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
    const rows = await db.suratMasuk.findMany({
      where,
      include: { kode: true, indeks: true, bidang: true },
      orderBy: { noUrut: "asc" },
      skip,
      take,
    });
    const buf = await exportSuratMasukExcel(rows);
    await writeAudit({ userId: user.id, action: "export_excel", entity: "surat_masuk" });
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="surat-masuk.xlsx"',
      },
    });
  },
);

suratMasukRoutes.get(
  "/export/pdf",
  requirePermission(PERMISSIONS.SURAT_MASUK_EXPORT),
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
    const rows = await db.suratMasuk.findMany({
      where,
      include: { kode: true, indeks: true, bidang: true },
      orderBy: { noUrut: "asc" },
      skip,
      take,
    });
    const html = exportSuratMasukPdfHtml(rows);
    await writeAudit({ userId: user.id, action: "export_pdf", entity: "surat_masuk" });
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  },
);

suratMasukRoutes.get(
  "/",
  requirePermission(PERMISSIONS.SURAT_MASUK_VIEW),
  zValidator("query", paginationQuery),
  async (c) => {
    const user = c.get("user")!;
    const q = c.req.valid("query");
    const where = buildWhere(user, q);
    const skip = (q.page - 1) * q.perPage;

    const [total, rows] = await Promise.all([
      db.suratMasuk.count({ where }),
      db.suratMasuk.findMany({
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
        labels: LABELS.suratMasuk,
      },
    });
  },
);

suratMasukRoutes.get(
  "/:id",
  requirePermission(PERMISSIONS.SURAT_MASUK_VIEW),
  zValidator("param", idParam),
  async (c) => {
    const { id } = c.req.valid("param");
    const row = await db.suratMasuk.findUnique({ where: { id }, include });
    if (!row) return c.json({ success: false, message: "Data tidak ditemukan" }, 404);
    return c.json({ success: true, data: mapRow(row) });
  },
);

suratMasukRoutes.post(
  "/",
  requirePermission(PERMISSIONS.SURAT_MASUK_CREATE),
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

    const parsed = suratMasukSchema.safeParse(body);
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

    const last = await db.suratMasuk.findFirst({ orderBy: { noUrut: "desc" } });
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

    const created = await db.suratMasuk.create({
      data: {
        noUrut,
        tanggalMasukSurat: parseDate(data.tanggalMasukSurat),
        asalSurat: data.asalSurat,
        tanggalSurat: parseDate(data.tanggalSurat),
        nomorSurat: data.nomorSurat,
        kodeId: data.kodeId,
        indeksId: data.indeksId ?? null,
        perihal: data.perihal,
        bidangId: data.bidangId,
        tanggalDisposisi: data.tanggalDisposisi ? parseDate(data.tanggalDisposisi) : null,
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
      entity: "surat_masuk",
      entityId: created.id,
      ipAddress: c.req.header("x-forwarded-for")?.split(",")[0],
    });

    void notifySuratMasukCreated({
      id: created.id,
      noUrut: created.noUrut,
      nomorSurat: created.nomorSurat,
      perihal: created.perihal,
      asalSurat: created.asalSurat,
      tanggalSurat: created.tanggalSurat,
      tanggalMasukSurat: created.tanggalMasukSurat,
      tanggalDisposisi: created.tanggalDisposisi,
      bidangId: created.bidangId,
      bidang: created.bidang,
      kode: created.kode,
      indeks: created.indeks,
      creator: created.creator,
      keterangan: created.keterangan,
    });

    return c.json(
      {
        success: true,
        message: "Surat masuk berhasil disimpan",
        data: mapRow(created),
      },
      201,
    );
  },
);

suratMasukRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.SURAT_MASUK_UPDATE),
  zValidator("param", idParam),
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const body = await c.req.json();
    const parsed = suratMasukSchema.safeParse(body);
    if (!parsed.success) {
      const formatted = formatZodError(parsed.error);
      return c.json(
        { success: false, message: formatted.message, errors: formatted.errors },
        422,
      );
    }
    const data = parsed.data;
    const existing = await db.suratMasuk.findUnique({ where: { id } });
    if (!existing) return c.json({ success: false, message: "Data tidak ditemukan" }, 404);

    const kodeErr = await assertKodeForSurat(data.kodeId);
    if (kodeErr) {
      return c.json({ success: false, message: kodeErr }, 422);
    }

    const updated = await db.suratMasuk.update({
      where: { id },
      data: {
        tanggalMasukSurat: parseDate(data.tanggalMasukSurat),
        asalSurat: data.asalSurat,
        tanggalSurat: parseDate(data.tanggalSurat),
        nomorSurat: data.nomorSurat,
        kodeId: data.kodeId,
        indeksId: data.indeksId ?? null,
        perihal: data.perihal,
        bidangId: data.bidangId,
        tanggalDisposisi: data.tanggalDisposisi ? parseDate(data.tanggalDisposisi) : null,
        keterangan: data.keterangan ?? null,
        updatedBy: user.id,
      },
      include,
    });

    await writeAudit({
      userId: user.id,
      action: "update",
      entity: "surat_masuk",
      entityId: id,
    });

    if (existing.bidangId !== data.bidangId) {
      const prevBidang = await db.bidang.findUnique({
        where: { id: existing.bidangId },
        select: { namaBidang: true },
      });
      void notifyDisposisiChanged({
        id: updated.id,
        noUrut: updated.noUrut,
        nomorSurat: updated.nomorSurat,
        perihal: updated.perihal,
        asalSurat: updated.asalSurat,
        bidangId: updated.bidangId,
        bidang: updated.bidang,
        previousBidang: prevBidang?.namaBidang ?? null,
        kode: updated.kode,
        updater: updated.updater,
      });
    }

    return c.json({ success: true, message: "Berhasil diubah", data: mapRow(updated) });
  },
);

suratMasukRoutes.delete(
  "/:id",
  requirePermission(PERMISSIONS.SURAT_MASUK_DELETE),
  zValidator("param", idParam),
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const existing = await db.suratMasuk.findUnique({ where: { id } });
    if (!existing) return c.json({ success: false, message: "Data tidak ditemukan" }, 404);

    await db.suratMasuk.delete({ where: { id } });
    await writeAudit({
      userId: user.id,
      action: "delete",
      entity: "surat_masuk",
      entityId: id,
      detail: existing.nomorSurat,
    });
    return c.json({ success: true, message: "Berhasil dihapus" });
  },
);

suratMasukRoutes.get(
  "/:id/file",
  requirePermission(PERMISSIONS.SURAT_MASUK_VIEW),
  zValidator("param", idParam),
  async (c) => {
    const { id } = c.req.valid("param");
    const row = await db.suratMasuk.findUnique({ where: { id } });
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
