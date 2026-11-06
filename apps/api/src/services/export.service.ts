import ExcelJS from "exceljs";
import { LABELS } from "@arsip/shared";
import { formatDate } from "../validators/common";

type SuratMasukRow = {
  noUrut: number;
  tanggalMasukSurat: Date;
  asalSurat: string;
  tanggalSurat: Date;
  nomorSurat: string;
  kode: { kode: string; namaKelompok: string };
  indeks: { namaIndeks: string } | null;
  perihal: string;
  bidang: { namaBidang: string };
  tanggalDisposisi: Date | null;
  keterangan: string | null;
};

type SuratKeluarRow = {
  noUrut: number;
  tanggalSurat: Date;
  nomorSurat: string;
  kode: { kode: string; namaKelompok: string };
  indeks: { namaIndeks: string } | null;
  perihal: string;
  ditujukanKepada: string;
  bidang: { namaBidang: string };
  keterangan: string | null;
};

/** Estimasi lebar kolom Excel dari panjang teks (auto-fit). */
function autoFitColumns(ws: ExcelJS.Worksheet, opts?: { min?: number; max?: number }) {
  const min = opts?.min ?? 8;
  const max = opts?.max ?? 60;
  ws.columns.forEach((col) => {
    let longest = min;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const raw = cell.value;
      const text =
        raw == null
          ? ""
          : typeof raw === "object" && "text" in raw
            ? String((raw as { text: string }).text ?? "")
            : String(raw);
      // karakter CJK/lebar penuh dihitung ~1.2, sisanya 1; padding kecil biar tidak mepet garis
      let units = 0;
      for (const ch of text) {
        units += ch.charCodeAt(0) > 255 ? 1.8 : 1;
      }
      longest = Math.max(longest, units + 2);
    });
    col.width = Math.min(max, Math.max(min, Math.ceil(longest)));
  });
}

/** Export Excel — header = label UI (100% sama) */
export async function exportSuratMasukExcel(rows: SuratMasukRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Arsip Surat";
  const ws = wb.addWorksheet("Surat Masuk");
  const L = LABELS.suratMasuk;

  ws.columns = [
    { header: L.noUrut, key: "noUrut", width: 10 },
    { header: L.tanggalMasukSurat, key: "tanggalMasukSurat", width: 18 },
    { header: L.asalSurat, key: "asalSurat", width: 28 },
    { header: L.tanggalSurat, key: "tanggalSurat", width: 14 },
    { header: L.nomorSurat, key: "nomorSurat", width: 22 },
    { header: L.kodeKlasifikasi, key: "kode", width: 22 },
    { header: L.indeks, key: "indeks", width: 18 },
    { header: L.perihal, key: "perihal", width: 40 },
    { header: L.disposisi, key: "disposisi", width: 22 },
    { header: L.tanggalDisposisi, key: "tanggalDisposisi", width: 16 },
    { header: L.keterangan, key: "keterangan", width: 28 },
  ];

  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      noUrut: r.noUrut,
      tanggalMasukSurat: formatDate(r.tanggalMasukSurat),
      asalSurat: r.asalSurat,
      tanggalSurat: formatDate(r.tanggalSurat),
      nomorSurat: r.nomorSurat,
      kode: `${r.kode.kode} - ${r.kode.namaKelompok}`,
      indeks: r.indeks?.namaIndeks ?? "",
      perihal: r.perihal,
      disposisi: r.bidang.namaBidang,
      tanggalDisposisi: formatDate(r.tanggalDisposisi),
      keterangan: r.keterangan ?? "",
    });
  }

  autoFitColumns(ws);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function exportSuratKeluarExcel(rows: SuratKeluarRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Surat Keluar");
  const L = LABELS.suratKeluar;

  ws.columns = [
    { header: L.noUrut, key: "noUrut", width: 10 },
    { header: L.tanggalSurat, key: "tanggalSurat", width: 14 },
    { header: L.nomorSurat, key: "nomorSurat", width: 22 },
    { header: L.kodeKlasifikasi, key: "kode", width: 22 },
    { header: L.indeks, key: "indeks", width: 18 },
    { header: L.perihal, key: "perihal", width: 40 },
    { header: L.ditujukanKepada, key: "ditujukanKepada", width: 28 },
    { header: L.pembuatSurat, key: "pembuat", width: 22 },
    { header: L.keterangan, key: "keterangan", width: 28 },
  ];

  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      noUrut: r.noUrut,
      tanggalSurat: formatDate(r.tanggalSurat),
      nomorSurat: r.nomorSurat,
      kode: `${r.kode.kode} - ${r.kode.namaKelompok}`,
      indeks: r.indeks?.namaIndeks ?? "",
      perihal: r.perihal,
      ditujukanKepada: r.ditujukanKepada,
      pembuat: r.bidang.namaBidang,
      keterangan: r.keterangan ?? "",
    });
  }

  autoFitColumns(ws);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** HTML laporan siap cetak (preview di browser + window.print) */
export function exportSuratMasukPdfHtml(rows: SuratMasukRow[], title = "Laporan Surat Masuk"): string {
  const L = LABELS.suratMasuk;
  const body =
    rows.length === 0
      ? `<tr><td colspan="11" class="empty">Tidak ada data untuk dicetak</td></tr>`
      : rows
          .map(
            (r, i) => `
    <tr class="${i % 2 ? "alt" : ""}">
      <td class="num">${r.noUrut}</td>
      <td class="nowrap">${formatDate(r.tanggalMasukSurat)}</td>
      <td>${esc(r.asalSurat)}</td>
      <td class="nowrap">${formatDate(r.tanggalSurat)}</td>
      <td class="nowrap">${esc(r.nomorSurat)}</td>
      <td>${esc(`${r.kode.kode} — ${r.kode.namaKelompok}`)}</td>
      <td>${esc(r.indeks?.namaIndeks ?? "—")}</td>
      <td>${esc(r.perihal)}</td>
      <td>${esc(r.bidang.namaBidang)}</td>
      <td class="nowrap">${formatDate(r.tanggalDisposisi) || "—"}</td>
      <td>${esc(r.keterangan ?? "—")}</td>
    </tr>`,
          )
          .join("");

  return printShell(
    title,
    rows.length,
    `
    <table>
      <thead>
        <tr>
          <th>${L.noUrut}</th>
          <th>${L.tanggalMasukSurat}</th>
          <th>${L.asalSurat}</th>
          <th>${L.tanggalSurat}</th>
          <th>${L.nomorSurat}</th>
          <th>${L.kodeKlasifikasi}</th>
          <th>${L.indeks}</th>
          <th>${L.perihal}</th>
          <th>${L.disposisi}</th>
          <th>${L.tanggalDisposisi}</th>
          <th>${L.keterangan}</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`,
  );
}

export function exportSuratKeluarPdfHtml(rows: SuratKeluarRow[], title = "Laporan Surat Keluar"): string {
  const L = LABELS.suratKeluar;
  const body =
    rows.length === 0
      ? `<tr><td colspan="9" class="empty">Tidak ada data untuk dicetak</td></tr>`
      : rows
          .map(
            (r, i) => `
    <tr class="${i % 2 ? "alt" : ""}">
      <td class="num">${r.noUrut}</td>
      <td class="nowrap">${formatDate(r.tanggalSurat)}</td>
      <td class="nowrap">${esc(r.nomorSurat)}</td>
      <td>${esc(`${r.kode.kode} — ${r.kode.namaKelompok}`)}</td>
      <td>${esc(r.indeks?.namaIndeks ?? "—")}</td>
      <td>${esc(r.perihal)}</td>
      <td>${esc(r.ditujukanKepada)}</td>
      <td>${esc(r.bidang.namaBidang)}</td>
      <td>${esc(r.keterangan ?? "—")}</td>
    </tr>`,
          )
          .join("");

  return printShell(
    title,
    rows.length,
    `
    <table>
      <thead>
        <tr>
          <th>${L.noUrut}</th>
          <th>${L.tanggalSurat}</th>
          <th>${L.nomorSurat}</th>
          <th>${L.kodeKlasifikasi}</th>
          <th>${L.indeks}</th>
          <th>${L.perihal}</th>
          <th>${L.ditujukanKepada}</th>
          <th>${L.pembuatSurat}</th>
          <th>${L.keterangan}</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`,
  );
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printShell(title: string, total: number, content: string) {
  const printedAt = new Date().toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<style>
  :root {
    --ink: #0f172a;
    --muted: #64748b;
    --line: #e2e8f0;
    --soft: #f8fafc;
    --brand: #2563eb;
    --brand-dark: #1d4ed8;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
    font-size: 12px;
    color: var(--ink);
    background: #eef2f7;
    line-height: 1.45;
  }
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(15, 23, 42, 0.92);
    color: #fff;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.18);
  }
  .toolbar .hint { font-size: 12px; color: #cbd5e1; }
  .toolbar .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .toolbar button {
    appearance: none;
    border: 0;
    border-radius: 10px;
    padding: 9px 16px;
    font: inherit;
    font-weight: 650;
    cursor: pointer;
    transition: transform .12s ease, opacity .12s ease;
  }
  .toolbar button:active { transform: scale(.98); }
  .toolbar .btn-print { background: #22c55e; color: #052e16; }
  .toolbar .btn-print:hover { background: #16a34a; color: #fff; }
  .toolbar .btn-close { background: #334155; color: #fff; }
  .toolbar .btn-close:hover { background: #475569; }
  .sheet {
    max-width: 1200px;
    margin: 18px auto 40px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
    overflow: hidden;
  }
  .doc-head {
    padding: 22px 24px 16px;
    border-bottom: 2px solid var(--brand);
    background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
  }
  .org {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .org-mark {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: var(--brand);
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 12px;
    letter-spacing: -.02em;
    flex-shrink: 0;
  }
  .org-name { font-size: 13px; font-weight: 700; color: var(--ink); }
  .org-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -.02em;
    color: var(--ink);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-top: 10px;
    color: var(--muted);
    font-size: 11.5px;
  }
  .meta strong { color: var(--ink); font-weight: 650; }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    background: #eff6ff;
    color: var(--brand-dark);
    font-weight: 650;
    font-size: 11px;
  }
  .table-wrap { padding: 0 12px 18px; overflow-x: auto; }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    min-width: 900px;
    margin-top: 12px;
  }
  th, td {
    border-bottom: 1px solid var(--line);
    border-right: 1px solid var(--line);
    padding: 8px 9px;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
  }
  th:first-child, td:first-child { border-left: 1px solid var(--line); }
  thead th {
    background: #0f172a;
    color: #f8fafc;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .03em;
    position: sticky;
    top: 0;
    white-space: nowrap;
  }
  thead th:first-child { border-top-left-radius: 10px; }
  thead th:last-child { border-top-right-radius: 10px; border-right: 1px solid #0f172a; }
  tbody tr.alt td { background: var(--soft); }
  tbody tr:hover td { background: #eff6ff; }
  td.num { text-align: center; font-variant-numeric: tabular-nums; font-weight: 650; width: 48px; }
  td.nowrap { white-space: nowrap; }
  td.empty { text-align: center; color: var(--muted); padding: 28px 12px; font-style: italic; }
  .doc-foot {
    padding: 12px 24px 20px;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    color: var(--muted);
    font-size: 11px;
    border-top: 1px solid var(--line);
  }
  @media print {
    @page { size: A4 landscape; margin: 10mm; }
    body { background: #fff; }
    .toolbar { display: none !important; }
    .sheet {
      max-width: none;
      margin: 0;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    .doc-head { padding: 0 0 10px; background: none; }
    .table-wrap { padding: 0; overflow: visible; }
    table { min-width: 0; font-size: 9.5px; }
    th, td { padding: 5px 6px; }
    thead th {
      background: #e2e8f0 !important;
      color: #0f172a !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    tbody tr.alt td {
      background: #f8fafc !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    tbody tr:hover td { background: inherit; }
    .doc-foot { padding: 10px 0 0; }
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <div>
      <div style="font-weight:700;font-size:14px">Preview Cetak</div>
      <div class="hint">Periksa data, lalu tekan Cetak. Gunakan kertas A4 landscape.</div>
    </div>
    <div class="actions">
      <button type="button" class="btn-print" onclick="window.print()">Cetak / Simpan PDF</button>
      <button type="button" class="btn-close" onclick="window.close()">Tutup</button>
    </div>
  </div>
  <div class="sheet">
    <div class="doc-head">
      <div class="org">
        <div class="org-mark">AS</div>
        <div>
          <div class="org-name">Sistem Arsip Surat · Kemendikdasmen</div>
          <div class="org-sub">Dokumen resmi hasil filter data arsip</div>
        </div>
      </div>
      <h1>${esc(title)}</h1>
      <div class="meta">
        <span class="badge">${total} data</span>
        <span>Dicetak: <strong>${esc(printedAt)}</strong></span>
      </div>
    </div>
    <div class="table-wrap">${content}</div>
    <div class="doc-foot">
      <span>Arsip Surat — dokumen digenerate otomatis</span>
      <span>Halaman dicetak dari filter aktif</span>
    </div>
  </div>
</body>
</html>`;
}
