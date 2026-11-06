import { db } from "./db";

/** Level dari pola kode — tanpa table baru. */
export type KodeLevel = "kategori" | "kelompok" | "detail";

export function getKodeLevel(kode: string): KodeLevel {
  const dots = (kode.match(/\./g) ?? []).length;
  if (dots === 0) return "kategori";
  if (dots === 1) return "kelompok";
  return "detail";
}

/** Prefix kelompok parent (mis. 000.1.2 → 000.1). null jika baris itu sendiri kelompok. */
export function getKelompokKode(kode: string): string | null {
  if (getKodeLevel(kode) !== "detail") return null;
  const parts = kode.split(".");
  if (parts.length < 2) return null;
  return `${parts[0]}.${parts[1]}`;
}

/**
 * Kode intermediate (1 titik, mis. 000.1 / 000.2) = level kelompok.
 * Bukan opsi pemilihan di surat masuk/keluar.
 * Kode detail (2+ titik, mis. 000.1.2) = boleh dipilih di surat.
 */
export function isKodeSelectableForSurat(kode: string): boolean {
  return getKodeLevel(kode) === "detail";
}

export function isKodeIntermediate(kode: string): boolean {
  return getKodeLevel(kode) === "kelompok";
}

/** Validasi kode untuk form surat; return pesan error atau null jika OK */
export async function assertKodeForSurat(kodeId: number): Promise<string | null> {
  const row = await db.masterKode.findUnique({
    where: { id: kodeId },
    select: { id: true, kode: true, status: true },
  });
  if (!row || !row.status) {
    return "Kode klasifikasi tidak ditemukan atau nonaktif";
  }
  if (!isKodeSelectableForSurat(row.kode)) {
    return "Kode kelompok (mis. 000.1) tidak bisa dipilih di surat. Pilih indeks (mis. 000.1.2).";
  }
  return null;
}

/**
 * Kode harus berawalan kode_awal kategori (mis. kategori 200 → kode 200.1.2).
 * Return pesan error atau null jika OK.
 */
export async function assertKodeMatchesKategori(
  kategoriId: number,
  kode: string,
): Promise<string | null> {
  const kat = await db.masterKategori.findUnique({
    where: { id: kategoriId },
    select: { id: true, kodeAwal: true, namaKategori: true, status: true },
  });
  if (!kat || !kat.status) {
    return "Kategori tidak ditemukan atau nonaktif";
  }
  const prefix = `${kat.kodeAwal}.`;
  const trimmed = kode.trim();
  if (trimmed !== kat.kodeAwal && !trimmed.startsWith(prefix)) {
    return `Kode harus diawali prefix kategori "${kat.kodeAwal}." (contoh: ${kat.kodeAwal}.1.2)`;
  }
  if (trimmed === kat.kodeAwal || trimmed === prefix) {
    return `Lengkapi kode setelah prefix ${kat.kodeAwal}. (contoh: ${kat.kodeAwal}.1 atau ${kat.kodeAwal}.1.2)`;
  }
  return null;
}

/** kind=kelompok → tepat 1 titik (000.1); kind=indeks → 2+ titik (000.1.2) */
export function assertKodeKind(
  kode: string,
  kind: "kelompok" | "indeks",
): string | null {
  const level = getKodeLevel(kode.trim());
  if (kind === "kelompok") {
    if (level !== "kelompok") {
      return "Kode kelompok harus 1 titik (contoh: 000.1, 200.2)";
    }
    return null;
  }
  if (level !== "detail") {
    return "Kode indeks harus 2+ titik (contoh: 000.1.2, 200.1.1)";
  }
  return null;
}
