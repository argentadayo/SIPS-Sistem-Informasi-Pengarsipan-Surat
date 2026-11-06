import { Hono } from "hono";
import { requireAuth, requirePermission } from "../middleware/auth";
import { uploadRateLimit } from "../middleware/rate-limit";
import { detectMime } from "../services/file.service";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { PERMISSIONS } from "@arsip/shared";
import type { AppVariables } from "../types/context";

/**
 * Proxy ke service OCR (PaddleOCR + LayoutLMv3, lihat ocr/serve.py).
 * Dipakai form surat untuk auto-fill field dari gambar scan.
 */
export const ocrRoutes = new Hono<{ Variables: AppVariables }>();

ocrRoutes.use("*", requireAuth);

/** OCR di CPU bisa makan beberapa detik — kasih ruang, jangan sampai dipotong duluan */
const OCR_TIMEOUT_MS = 60_000;
const ALLOWED_OCR_MIME = new Set(["image/jpeg", "image/png"]);

type OcrPredictResult = { fields: Record<string, string>; words: number };

ocrRoutes.post(
  "/predict",
  requirePermission(PERMISSIONS.SURAT_MASUK_CREATE, PERMISSIONS.SURAT_KELUAR_CREATE),
  uploadRateLimit,
  async (c) => {
    if (!env.OCR_SERVICE_URL) {
      return c.json({ success: false, message: "Fitur OCR tidak diaktifkan" }, 503);
    }

    const form = await c.req.parseBody({ all: true });
    const file = form["file"];
    if (!(file instanceof File) || file.size === 0) {
      return c.json({ success: false, message: "File gambar wajib diunggah" }, 422);
    }
    const maxBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      return c.json(
        { success: false, message: `Ukuran file maksimal ${env.MAX_FILE_SIZE_MB} MB` },
        422,
      );
    }

    // Validasi konten: hanya JPG/PNG yang bisa dibaca OCR service
    const buf = Buffer.from(await file.arrayBuffer());
    const magicMime = detectMime(buf.subarray(0, 8));
    if (!magicMime || !ALLOWED_OCR_MIME.has(magicMime)) {
      return c.json(
        { success: false, message: "Format harus JPG atau PNG agar bisa dibaca OCR" },
        422,
      );
    }

    // Forward multipart apa adanya ke service OCR
    const upstream = new FormData();
    upstream.append("file", file, file.name || "scan");
    let res: Response;
    try {
      res = await fetch(`${env.OCR_SERVICE_URL}/predict`, {
        method: "POST",
        body: upstream,
        signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
      });
    } catch (e) {
      logger.warn("ocr_upstream_failed", { error: String(e) });
      return c.json(
        { success: false, message: "Service OCR tidak tersedia. Coba lagi nanti." },
        503,
      );
    }

    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
      const message = detail?.detail;
      if (res.status === 400 || res.status === 413) {
        return c.json({ success: false, message: message ?? "Gambar tidak valid" }, res.status);
      }
      logger.warn("ocr_upstream_error", { status: res.status });
      return c.json({ success: false, message: "Service OCR gagal memproses gambar" }, 502);
    }

    const data = (await res.json()) as Partial<OcrPredictResult>;
    const fields = data.fields ?? {};
    if (Object.keys(fields).length === 0) {
      return c.json(
        { success: false, message: "OCR tidak menemukan teks pada gambar" },
        422,
      );
    }

    return c.json({ success: true, data: { fields, words: data.words ?? 0 } });
  },
);
