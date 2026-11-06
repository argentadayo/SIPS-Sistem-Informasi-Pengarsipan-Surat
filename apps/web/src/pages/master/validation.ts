import type { Kategori } from "./types";

export function countDots(kode: string): number {
  return (kode.match(/\./g) ?? []).length;
}

/** Kode harus berawalan kode_awal kategori (mis. 200.1.2). */
export function validateKodePrefix(
  kategori: Kategori[],
  kategoriId: string,
  kode: string,
): string | null {
  const kat = kategori.find((x) => String(x.id) === kategoriId);
  if (!kat) return "Pilih kategori dulu";
  const prefix = `${kat.kodeAwal}.`;
  const trimmed = kode.trim();
  if (trimmed !== kat.kodeAwal && !trimmed.startsWith(prefix)) {
    return `Kode harus diawali "${kat.kodeAwal}." (contoh: ${kat.kodeAwal}.1.2)`;
  }
  if (trimmed === kat.kodeAwal || trimmed === prefix) {
    return `Lengkapi kode setelah ${kat.kodeAwal}. (contoh: ${kat.kodeAwal}.1.2)`;
  }
  return null;
}

export function validateKategoriKodeAwal(kodeAwal: string): string | null {
  if (!/^\d{3}$/.test(kodeAwal.trim())) {
    return "Kode awal kategori harus 3 digit (contoh: 000, 100, 200)";
  }
  return null;
}

/** Saat ganti kategori: isi/ganti prefix di field kode. */
export function applyKategoriPrefix(
  kategori: Kategori[],
  prevKategoriId: string,
  nextKategoriId: string,
  currentKode: string,
): string {
  const kat = kategori.find((x) => String(x.id) === nextKategoriId);
  const prefix = kat ? `${kat.kodeAwal}.` : "";
  const prevKat = kategori.find((x) => String(x.id) === prevKategoriId);
  const prevPrefix = prevKat ? `${prevKat.kodeAwal}.` : "";
  const onlyPrefix =
    !currentKode.trim() ||
    currentKode === prevPrefix ||
    currentKode === prevKat?.kodeAwal ||
    /^\d{3}\.?$/.test(currentKode.trim());

  if (onlyPrefix) return prefix;
  if (prevPrefix && currentKode.startsWith(prevPrefix)) {
    return `${prefix}${currentKode.slice(prevPrefix.length)}`;
  }
  if (currentKode.startsWith(prefix)) return currentKode;
  return prefix;
}

export function kategoriToOptions(kategori: Kategori[]) {
  return kategori.map((k) => ({
    value: String(k.id),
    label: `${k.kodeAwal} - ${k.namaKategori}`,
  }));
}
