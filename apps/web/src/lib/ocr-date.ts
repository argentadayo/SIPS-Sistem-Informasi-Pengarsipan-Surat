/** Nama bulan Indonesia (+ singkatan & typo umum) → angka bulan */
const MONTHS: Record<string, number> = {
  januari: 1,
  februari: 2,
  febuari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  agu: 8,
  agt: 8,
  sep: 9,
  okt: 10,
  nov: 11,
  des: 12,
};

function toIso(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Ekstrak tanggal dari teks OCR bebas → "YYYY-MM-DD" (untuk input type=date).
 * Contoh: "Desaru10Februari2007" → "2007-02-10"; "10/02/2007" → "2007-02-10";
 * "2007-02-10" → "2007-02-10". Null kalau tidak ada tanggal valid —
 * jangan pernah isi field tanggal dengan teks yang belum valid.
 */
export function parseTanggalOcr(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/\s+/g, " ");

  // "10 Februari 2007", "10februari2007", "10-Feb-2007", "10.februari.2007"
  const nama = t.match(/(\d{1,2})[\s.\-]*([a-z]{3,9})[\s.\-]*(\d{4})/);
  if (nama) {
    const month = MONTHS[nama[2]!];
    if (month) {
      const res = toIso(Number(nama[3]), month, Number(nama[1]));
      if (res) return res;
    }
  }

  // "10/02/2007", "10-02-2007", "10.02.2007" (konvensi Indonesia: hari-bulan-tahun)
  const num = t.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (num) {
    const res = toIso(Number(num[3]), Number(num[2]), Number(num[1]));
    if (res) return res;
  }

  // "2007-02-10" (ISO)
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const res = toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (res) return res;
  }

  return null;
}
