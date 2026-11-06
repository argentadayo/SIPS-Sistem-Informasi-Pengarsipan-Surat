/**
 * Pecah enumerasi bernomor jadi satu baris per item:
 *   "1. Bapak A 2. Ibu B 3. Sdr C" → "1. Bapak A\n2. Ibu B\n3. Sdr C"
 *
 * Guard yang disengaja supaya tidak salah potong:
 * - angka maks 2 digit + titik + spasi + non-digit  → "1. Budi" ✓, "Rp 2.500" ✗, "3.14" ✗
 * - hanya menyisip \n sebelum nomor yang DI TENGAH teks (bukan nomor pertama)
 * - idempotent: teks yang sudah multi-baris tidak berubah
 */
export function splitNomorPerBaris(text: string): string {
  if (!text) return text;
  const t = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return t.replace(/(\S)\s+(?=\d{1,2}\.\s\D)/g, "$1\n");
}
