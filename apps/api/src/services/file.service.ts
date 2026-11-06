import { join, extname, isAbsolute } from "path";
import { mkdir } from "fs/promises";
import { env } from "../lib/env";
import { generateFileUuid } from "../lib/crypto";
import { logger } from "../lib/logger";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXT = new Set([".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"]);

const MAGIC: { mime: string; bytes: number[] }[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  // DOC (OLE) / DOCX (ZIP) — dicek partial
  { mime: "application/msword", bytes: [0xd0, 0xcf, 0x11, 0xe0] },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes: [0x50, 0x4b, 0x03, 0x04],
  },
];

/** Absolute path (Docker) atau relative ke folder api/ (dev lokal) */
function resolvePath(rel: string) {
  if (isAbsolute(rel)) return rel;
  return join(import.meta.dir, "..", "..", rel);
}

export async function ensureDirs() {
  await mkdir(resolvePath(env.UPLOAD_DIR), { recursive: true });
  await mkdir(resolvePath(env.TEMP_DIR), { recursive: true });
}

export function detectMime(buf: Buffer): string | null {
  for (const m of MAGIC) {
    if (buf.length >= m.bytes.length && m.bytes.every((b, i) => buf[i] === b)) {
      return m.mime;
    }
  }
  return null;
}

export type ProcessedFile = {
  filePath: string;
  fileOriginalName: string;
  fileMime: string;
  fileSize: number;
};

export async function processUpload(file: File): Promise<ProcessedFile> {
  const maxBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`Ukuran file maksimal ${env.MAX_FILE_SIZE_MB} MB`);
  }
  if (file.size === 0) {
    throw new Error("File kosong");
  }

  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error("Ekstensi file tidak diizinkan. Gunakan PDF, JPG, PNG, DOC, DOCX");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const magicMime = detectMime(buf);
  const declared = file.type || "";

  // Validasi magic bytes (DOCX = ZIP, DOC = OLE)
  if (!magicMime) {
    throw new Error("Tipe file tidak valid (magic bytes)");
  }
  if (!ALLOWED_MIME.has(magicMime)) {
    throw new Error("MIME file tidak diizinkan");
  }
  // declared mime boleh kosong (beberapa browser), tapi jika ada harus cocok family
  if (declared && declared !== magicMime) {
    // izinkan image/jpg vs image/jpeg mismatch ringan
    const ok =
      (declared === "image/jpg" && magicMime === "image/jpeg") ||
      (declared.includes("word") && magicMime.includes("word")) ||
      declared === magicMime;
    if (!ok && env.NODE_ENV === "production") {
      throw new Error("MIME file tidak sesuai konten");
    }
  }

  await ensureDirs();
  const uuid = generateFileUuid();
  // Simpan dengan ekstensi aman berdasarkan magic (bukan nama user)
  let safeExt = ".bin";
  if (magicMime === "application/pdf") safeExt = ".pdf";
  else if (magicMime === "image/jpeg") safeExt = ".jpg";
  else if (magicMime === "image/png") safeExt = ".png";
  else if (magicMime.includes("openxml")) safeExt = ".docx";
  else if (magicMime === "application/msword") safeExt = ".doc";

  const storedName = `${uuid}${safeExt}`;
  const absPath = join(resolvePath(env.UPLOAD_DIR), storedName);
  await Bun.write(absPath, buf);

  // Kompresi PDF sederhana via pdf-lib (jika PDF)
  if (safeExt === ".pdf") {
    try {
      await compressPdf(absPath);
    } catch (e) {
      logger.warn("pdf_compress_skip", { error: String(e) });
    }
  }

  return {
    filePath: storedName,
    fileOriginalName: file.name.slice(0, 255),
    fileMime: magicMime,
    fileSize: buf.length,
  };
}

async function compressPdf(absPath: string) {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await Bun.file(absPath).arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const compressed = await doc.save({ useObjectStreams: true });
  await Bun.write(absPath, compressed);
}

export function getUploadAbsolutePath(storedName: string): string {
  // cegah path traversal
  const base = storedName.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!base || base !== storedName) {
    throw new Error("Nama file tidak valid");
  }
  return join(resolvePath(env.UPLOAD_DIR), base);
}
