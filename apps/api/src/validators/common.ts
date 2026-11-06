import { z } from "zod";

export const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(15),
  search: z.string().max(200).optional().default(""),
  bidangId: z.coerce.number().int().positive().optional(),
  kodeId: z.coerce.number().int().positive().optional(),
  indeksId: z.coerce.number().int().positive().optional(),
  asalSurat: z.string().max(255).optional(),
  ditujukanKepada: z.string().max(255).optional(),
  dari: z.string().optional(),
  sampai: z.string().optional(),
  /** Field tanggal untuk filter range — tergantung jenis surat */
  dateField: z
    .enum(["tanggalMasukSurat", "tanggalSurat", "tanggalDisposisi"])
    .optional(),
});

/** Query export Excel / print PDF: filter + cakupan data */
export const exportPrintQuery = paginationQuery.extend({
  /** page = halaman tabel saat ini; all = semua hasil filter; range = no urut */
  scope: z.enum(["page", "all", "range"]).optional().default("all"),
  noUrutFrom: z.coerce.number().int().positive().optional(),
  noUrutTo: z.coerce.number().int().positive().optional(),
  /** Batas baris export. Default 1000, hard max 1000 */
  limit: z.coerce.number().int().min(1).max(1000).optional().default(1000),
});

/** Hard cap baris per export Excel / print (VPS aman) */
export const EXPORT_MAX_ROWS = 1000;
/** @deprecated pakai EXPORT_MAX_ROWS */
export const PRINT_MAX_ROWS = EXPORT_MAX_ROWS;

export const masterKodeListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional().default(""),
  kategoriId: z.coerce.number().int().positive().optional(),
  /** indeks = 2+ titik (default list); kelompok = 1 titik; all = keduanya */
  kind: z.enum(["indeks", "kelompok", "all"]).optional().default("indeks"),
  active: z
    .enum(["0", "1"])
    .optional()
    .transform((v) => v === "1"),
});

export const masterKodeSearchQuery = z.object({
  q: z.string().max(100).optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  active: z
    .enum(["0", "1"])
    .optional()
    .default("1")
    .transform((v) => v !== "0"),
  /** true = hanya kode detail (boleh dipilih di surat), exclude intermediate 000.1 / 000.2 */
  forSurat: z
    .enum(["0", "1"])
    .optional()
    .default("0")
    .transform((v) => v === "1"),
});

export const loginSchema = z.object({
  username: z.string().min(3).max(150).trim(),
  password: z.string().min(6).max(128),
});

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

/** FormData mengirim "" untuk field kosong — treat as null */
const emptyToNull = (v: unknown) =>
  v === "" || v === undefined || v === null ? null : v;

const optionalDate = z.preprocess(
  emptyToNull,
  dateStr.nullable().optional(),
);

const optionalPositiveInt = z.preprocess(
  emptyToNull,
  z.coerce.number().int().positive().nullable().optional(),
);

const FORBIDDEN_SURAT_CHARACTERS = /[!@#$%^*<>]/;
const SURAT_CHARACTER_MESSAGE =
  "tidak boleh mengandung karakter ! @ # $ % ^ * < >";

const suratText = (max: number, min = 0, minMessage?: string) =>
  z
    .string()
    .trim()
    .min(min, minMessage)
    .max(max)
    .refine((value) => !FORBIDDEN_SURAT_CHARACTERS.test(value), {
      message: SURAT_CHARACTER_MESSAGE,
    });

const optionalText = z.preprocess(
  emptyToNull,
  suratText(2000).nullable().optional(),
);

const FIELD_LABELS: Record<string, string> = {
  tanggalMasukSurat: "Tanggal masuk surat",
  asalSurat: "Asal surat",
  tanggalSurat: "Tanggal surat",
  nomorSurat: "No surat",
  kodeId: "Kode klasifikasi",
  indeksId: "Sub indeks",
  perihal: "Perihal",
  bidangId: "Disposisi / bidang",
  tanggalDisposisi: "Tanggal disposisi",
  keterangan: "Keterangan",
  ditujukanKepada: "Ditujukan kepada",
  nama: "Nama",
  username: "Username",
  email: "Email",
  password: "Kata sandi",
  roleId: "Peran",
  namaBidang: "Nama bidang",
  singkatan: "Singkatan",
  kode: "Kode",
  namaKelompok: "Indeks",
  kategoriId: "Kategori",
  namaIndeks: "Sub indeks",
  urutanIndeks: "Urutan",
};

function humanizeIssue(issue: z.ZodIssue): string {
  const path = issue.path.join(".") || "data";
  const label = FIELD_LABELS[path] ?? path;
  if (issue.code === "too_small") {
    if (issue.type === "string") {
      return issue.minimum === 1
        ? `${label} wajib diisi`
        : `${label} minimal ${issue.minimum} karakter`;
    }
    if (issue.type === "number") {
      return `${label} wajib dipilih`;
    }
  }
  if (issue.code === "invalid_type") {
    if (issue.received === "null" || issue.received === "undefined") {
      return `${label} wajib diisi`;
    }
    return `${label} tidak valid`;
  }
  if (issue.code === "invalid_string") {
    return issue.message.includes("tanggal") || issue.validation === "regex"
      ? `${label}: ${issue.message}`
      : `${label} format tidak valid`;
  }
  if (issue.message && issue.message !== "Required") {
    return `${label}: ${issue.message}`;
  }
  return `${label} tidak valid`;
}

/** Bangun pesan validasi yang menjelaskan field mana yang salah */
export function formatZodError(error: z.ZodError): {
  message: string;
  errors: { field: string; label: string; message: string }[];
} {
  const errors = error.issues.map((issue) => {
    const field = issue.path.join(".") || "_form";
    const label = FIELD_LABELS[field] ?? field;
    return {
      field,
      label,
      message: humanizeIssue(issue),
    };
  });
  // dedupe by field keep first
  const seen = new Set<string>();
  const unique = errors.filter((e) => {
    if (seen.has(e.field)) return false;
    seen.add(e.field);
    return true;
  });
  const message =
    unique.length === 1
      ? unique[0]!.message
      : `Validasi gagal: ${unique.map((e) => e.message).join("; ")}`;
  return { message, errors: unique };
}

export const suratMasukSchema = z.object({
  tanggalMasukSurat: dateStr,
  asalSurat: suratText(255, 2, "Asal surat minimal 2 karakter"),
  tanggalSurat: dateStr,
  nomorSurat: suratText(100, 2, "No surat minimal 2 karakter"),
  kodeId: z.coerce.number({ invalid_type_error: "Kode klasifikasi wajib dipilih" }).int().positive("Kode klasifikasi wajib dipilih"),
  indeksId: optionalPositiveInt,
  perihal: suratText(500, 2, "Perihal minimal 2 karakter"),
  bidangId: z.coerce.number({ invalid_type_error: "Disposisi wajib dipilih" }).int().positive("Disposisi wajib dipilih"),
  tanggalDisposisi: optionalDate,
  keterangan: optionalText,
});

export const suratKeluarSchema = z.object({
  tanggalSurat: dateStr,
  nomorSurat: suratText(100, 2, "No surat minimal 2 karakter"),
  kodeId: z.coerce.number({ invalid_type_error: "Kode klasifikasi wajib dipilih" }).int().positive("Kode klasifikasi wajib dipilih"),
  indeksId: optionalPositiveInt,
  perihal: suratText(500, 2, "Perihal minimal 2 karakter"),
  ditujukanKepada: suratText(
    255,
    2,
    "Ditujukan kepada minimal 2 karakter",
  ),
  bidangId: z.coerce.number({ invalid_type_error: "Bidang pembuat wajib dipilih" }).int().positive("Bidang pembuat wajib dipilih"),
  keterangan: optionalText,
});

export const bidangSchema = z.object({
  namaBidang: z.string().min(2).max(150).trim(),
  singkatan: z.string().min(1).max(20).trim(),
  status: z.boolean().default(true),
});

export const masterKategoriSchema = z.object({
  kodeAwal: z.string().min(1).max(5).trim(),
  namaKategori: z.string().min(2).max(150).trim(),
  status: z.boolean().default(true),
});

export const masterKodeSchema = z.object({
  kategoriId: z.coerce.number().int().positive(),
  kode: z.string().min(1).max(20).trim(),
  namaKelompok: z.string().min(2).max(2000).trim(),
  hasSubKode: z.boolean().default(false),
  status: z.boolean().default(true),
  /** kelompok = 000.1; indeks = 000.1.2 (default) */
  kind: z.enum(["kelompok", "indeks"]).optional().default("indeks"),
});

export const masterIndeksSchema = z.object({
  kodeId: z.coerce.number().int().positive(),
  namaIndeks: z.string().min(1).max(1000).trim(),
  urutanIndeks: z.coerce.number().int().min(1).default(1),
  status: z.boolean().default(true),
});

export const userSchema = z.object({
  nama: z.string().min(2).max(150).trim(),
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya huruf, angka, . _ -")
    .trim(),
  email: z.string().email().max(150).trim().toLowerCase(),
  password: z.string().min(8).max(128).optional(),
  roleId: z.coerce.number().int().positive(),
  bidangId: z.coerce.number().int().positive().optional().nullable(),
  status: z.boolean().default(true),
});

export function parseDate(s: string): Date {
  const d = new Date(s + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) throw new Error("Tanggal tidak valid");
  return d;
}

/** Awal hari (UTC) untuk filter `gte` */
export function parseDateStart(s: string): Date {
  return parseDate(s);
}

/**
 * Akhir hari inklusif untuk filter range.
 * Pakai `lt` hari berikutnya agar baris @db.Date di tanggal `sampai` ikut terambil.
 */
export function parseDateEndExclusive(s: string): Date {
  const d = parseDate(s);
  return new Date(d.getTime() + 24 * 60 * 60 * 1000);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}
