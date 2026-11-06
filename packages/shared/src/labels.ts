/** Label ramah pengguna — UI, Excel, PDF (sumber tunggal) */

export const LABELS = {
  suratMasuk: {
    noUrut: "No Urut",
    tanggalMasukSurat: "Tanggal Masuk Surat",
    asalSurat: "Asal Surat",
    tanggalSurat: "Tanggal Surat",
    nomorSurat: "No Surat",
    kodeKlasifikasi: "Kode Klasifikasi",
    indeks: "Sub Indeks",
    perihal: "Perihal",
    disposisi: "Disposisi",
    tanggalDisposisi: "Tanggal Disposisi",
    keterangan: "Keterangan",
    fileBukti: "File Bukti",
  },
  suratKeluar: {
    noUrut: "No Urut",
    tanggalSurat: "Tanggal Surat",
    nomorSurat: "No Surat",
    kodeKlasifikasi: "Kode Klasifikasi",
    indeks: "Sub Indeks",
    perihal: "Perihal",
    ditujukanKepada: "Ditujukan Kepada",
    pembuatSurat: "Pembuat Surat",
    keterangan: "Keterangan",
    fileBukti: "File Bukti",
  },
} as const;

export type SuratMasukLabels = typeof LABELS.suratMasuk;
export type SuratKeluarLabels = typeof LABELS.suratKeluar;
