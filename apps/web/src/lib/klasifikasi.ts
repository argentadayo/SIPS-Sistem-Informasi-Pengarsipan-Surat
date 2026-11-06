/**
 * Helpers pola kode klasifikasi (shared FE).
 * Master page validation: pages/master/validation.ts
 */
export type KodeLevel = "kategori" | "kelompok" | "detail";

export function getKodeLevel(kode: string): KodeLevel {
  const dots = (kode.match(/\./g) ?? []).length;
  if (dots === 0) return "kategori";
  if (dots === 1) return "kelompok";
  return "detail";
}

/** Prefix kelompok parent (mis. 000.1.2 → 000.1). */
export function getKelompokKode(kode: string): string | null {
  if (getKodeLevel(kode) !== "detail") return null;
  const parts = kode.split(".");
  if (parts.length < 2) return null;
  return `${parts[0]}.${parts[1]}`;
}

/** Boleh dipilih di form surat (indeks / 2+ titik). */
export function isKodeSelectableForSurat(kode: string): boolean {
  return getKodeLevel(kode) === "detail";
}
