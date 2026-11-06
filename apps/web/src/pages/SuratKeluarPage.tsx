import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, can, formatApiError } from "../lib/api";
import { parseTanggalOcr } from "../lib/ocr-date";
import { splitNomorPerBaris } from "../lib/text-format";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import {
  AdvancedFilters,
  buildSuratQuery,
  emptySuratFiltersKeluar,
  type SuratFilterValues,
} from "../components/AdvancedFilters";
import {
  PrintConfigModal,
  type PrintConfig,
} from "../components/PrintConfigModal";
import {
  ExportConfigModal,
  type ExportConfig,
} from "../components/ExportConfigModal";
import {
  AsyncSearchableSelect,
  Button,
  Card,
  Empty,
  FieldRow,
  FileDropzone,
  IconBtn,
  IconEdit,
  IconEye,
  IconTrash,
  Input,
  MobileCard,
  Modal,
  PageHeader,
  Pagination,
  SearchableSelect,
  Table,
  Textarea,
  type SearchableSelectOption,
} from "../components/ui";

type Row = {
  id: number;
  noUrut: number;
  tanggalSurat: string;
  nomorSurat: string;
  kodeId: number;
  kodeKlasifikasi: string;
  indeksId: number | null;
  indeks: string | null;
  perihal: string;
  ditujukanKepada: string;
  bidangId: number;
  pembuatSurat: string;
  keterangan: string | null;
  hasFile: boolean;
};

type Bidang = { id: number; namaBidang: string };

const emptyForm = {
  tanggalSurat: "",
  nomorSurat: "",
  kodeId: "",
  indeksId: "",
  perihal: "",
  ditujukanKepada: "",
  bidangId: "",
  keterangan: "",
};

export function SuratKeluarPage() {
  const { user } = useAuth();
  const canCreate = can(user, "surat-keluar.create");
  const canUpdate = can(user, "surat-keluar.update");
  const canDelete = can(user, "surat-keluar.delete");
  const canExport = can(user, "surat-keluar.export");
  const toast = useToast();

  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [perPage, setPerPage] = useState(10);
  const [filters, setFilters] = useState<SuratFilterValues>(emptySuratFiltersKeluar);
  const [applied, setApplied] = useState<SuratFilterValues>(emptySuratFiltersKeluar);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [bidangList, setBidangList] = useState<Bidang[]>([]);
  const [kodeLabel, setKodeLabel] = useState("");
  const [indeksOptions, setIndeksOptions] = useState<SearchableSelectOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const isSuperAdmin = user?.roleName === "Super Admin";

  const load = useCallback(
    async (page = 1, f = applied, size = perPage, preferLast = false) => {
      setLoading(true);
      try {
        const qs = buildSuratQuery(f, { partyParam: "ditujukanKepada", page, perPage: size });
        const res = await api.get<Row[]>(`/api/surat-keluar?${qs}`);
        if (!res.success || !Array.isArray(res.data)) {
          setRows([]);
          return;
        }
        const totalPages = Math.max(1, Number(res.meta?.totalPages ?? 1) || 1);
        const total = Number(res.meta?.total ?? 0) || 0;
        if (preferLast && totalPages > page) {
          const qsLast = buildSuratQuery(f, {
            partyParam: "ditujukanKepada",
            page: totalPages,
            perPage: size,
          });
          const last = await api.get<Row[]>(`/api/surat-keluar?${qsLast}`);
          if (last.success && Array.isArray(last.data)) {
            setRows(last.data);
            setMeta({
              page: totalPages,
              totalPages,
              total: Number(last.meta?.total ?? total) || total,
            });
            return;
          }
        }
        setRows(res.data);
        setMeta({
          page: Number(res.meta?.page ?? page) || page,
          totalPages,
          total,
        });
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [applied, perPage],
  );

  useEffect(() => {
    void load(1, applied, perPage, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filter/page size changes via `load`
  }, [load]);

  useEffect(() => {
    api.get<Bidang[]>("/api/master/bidang").then((r) => r.data && setBidangList(r.data));
  }, []);

  const searchKode = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", "30");
    params.set("active", "1");
    params.set("forSurat", "1");
    const res = await api.get<{ id: number; kode: string; namaKelompok: string }[]>(
      `/api/master/kode/search?${params}`,
    );
    return (res.data ?? []).map((k) => ({
      value: String(k.id),
      label: `${k.kode} - ${k.namaKelompok}`,
    }));
  }, []);

  useEffect(() => {
    if (!form.kodeId) {
      setIndeksOptions([]);
      return;
    }
    let cancelled = false;
    void api
      .get<{ id: number; namaIndeks: string }[]>(
        `/api/master/indeks?kodeId=${form.kodeId}&active=1`,
      )
      .then((res) => {
        if (cancelled) return;
        setIndeksOptions(
          (res.data ?? []).map((i) => ({
            value: String(i.id),
            label: i.namaIndeks,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [form.kodeId]);

  const bidangOptions = useMemo(
    () => bidangList.map((b) => ({ value: String(b.id), label: b.namaBidang })),
    [bidangList],
  );

  /** Auto-fill form dari hasil OCR gambar scan (service ocr via API) */
  async function autofillFromScan() {
    if (!file) return;
    setOcrLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post<{ fields: Record<string, string>; words: number }>(
      "/api/ocr/predict",
      fd,
    );
    setOcrLoading(false);
    if (!res.success || !res.data) {
      toast.error(formatApiError(res, "Gagal membaca scan"));
      return;
    }
    const f = res.data.fields;
    const tanggal = parseTanggalOcr(f.tanggal_surat);
    setForm((prev) => ({
      ...prev,
      nomorSurat: f.nomor || prev.nomorSurat,
      perihal: f.perihal || prev.perihal,
      ditujukanKepada: f.kepada ? splitNomorPerBaris(f.kepada) : prev.ditujukanKepada,
      tanggalSurat: tanggal ?? prev.tanggalSurat,
    }));
    const filled = [
      f.nomor && "no surat",
      f.perihal && "perihal",
      f.kepada && "ditujukan kepada",
      tanggal && "tanggal surat",
    ]
      .filter(Boolean)
      .join(", ");
    toast.success(filled ? `Terisi otomatis: ${filled}` : "Model tidak mengenali field pada scan");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    if (editId) {
      const res = await api.put(`/api/surat-keluar/${editId}`, {
        ...form,
        kodeId: Number(form.kodeId),
        indeksId: form.indeksId ? Number(form.indeksId) : null,
        bidangId: Number(form.bidangId),
        keterangan: form.keterangan || null,
      });
      setSaving(false);
      if (!res.success) {
        toast.error(formatApiError(res, "Gagal menyimpan surat keluar"));
        return;
      }
      toast.success("Surat keluar berhasil diperbarui");
    } else {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== "" && v != null) fd.append(k, v);
      });
      if (file) fd.append("file", file);
      const res = await api.post("/api/surat-keluar", fd);
      setSaving(false);
      if (!res.success) {
        toast.error(formatApiError(res, "Gagal menyimpan surat keluar"));
        return;
      }
      toast.success("Surat keluar berhasil disimpan");
    }

    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setFile(null);
    void load(1, applied, perPage, true);
  }

  function openCreate() {
    setEditId(null);
    setForm({
      ...emptyForm,
      bidangId: !isSuperAdmin && user?.bidangId ? String(user.bidangId) : "",
    });
    setKodeLabel("");
    setIndeksOptions([]);
    setFile(null);
    setShowForm(true);
  }

  function openEdit(r: Row) {
    setEditId(r.id);
    setForm({
      tanggalSurat: r.tanggalSurat,
      nomorSurat: r.nomorSurat,
      kodeId: String(r.kodeId),
      indeksId: r.indeksId != null ? String(r.indeksId) : "",
      perihal: r.perihal,
      ditujukanKepada: splitNomorPerBaris(r.ditujukanKepada),
      bidangId: String(r.bidangId),
      keterangan: r.keterangan || "",
    });
    setKodeLabel(r.kodeKlasifikasi);
    setFile(null);
    setShowForm(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await api.del(`/api/surat-keluar/${deleteTarget.id}`);
    setDeleting(false);
    if (res.success) {
      toast.success("Surat keluar berhasil dihapus");
      setDeleteTarget(null);
      void load(meta.page);
    } else {
      toast.error(formatApiError(res, "Gagal menghapus surat keluar"));
      setDeleteTarget(null);
    }
  }

  function buildExportParams(cfg: PrintConfig | ExportConfig) {
    const base = buildSuratQuery(applied, {
      partyParam: "ditujukanKepada",
      page: cfg.scope === "page" ? meta.page : 1,
      perPage: cfg.scope === "page" ? perPage : 50,
    });
    const params = new URLSearchParams(base);
    params.set("scope", cfg.scope);
    if (cfg.scope === "range") {
      if (cfg.noUrutFrom.trim()) params.set("noUrutFrom", cfg.noUrutFrom.trim());
      if (cfg.noUrutTo.trim()) params.set("noUrutTo", cfg.noUrutTo.trim());
    }
    if (cfg.scope === "all") params.set("limit", "1000");
    return params;
  }

  async function runPrint(cfg: PrintConfig) {
    setPrintLoading(true);
    try {
      const params = buildExportParams(cfg);
      await api.openPrint(`/api/surat-keluar/export/pdf?${params}`);
      setPrintOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuka preview cetak");
    } finally {
      setPrintLoading(false);
    }
  }

  async function runExport(cfg: ExportConfig) {
    setExportLoading(true);
    try {
      const params = buildExportParams(cfg);
      await api.download(`/api/surat-keluar/export/excel?${params}`, "surat-keluar.xlsx");
      toast.success("File Excel berhasil diunduh");
      setExportOpen(false);
    } catch {
      toast.error("Gagal mengunduh Excel");
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Surat Keluar"
        subtitle={`${meta.total} arsip tercatat · tujuan & pembuat surat`}
        actions={
          <div className="flex w-full min-w-0 max-w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            {canExport && (
              <>
                <button
                  type="button"
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600 sm:flex-none sm:px-3.5 sm:text-sm"
                  onClick={() => setPrintOpen(true)}
                >
                  Print Dokumen
                </button>
                <button
                  type="button"
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 sm:flex-none sm:px-3.5 sm:text-sm"
                  onClick={() => setExportOpen(true)}
                >
                  Ekspor Tabel
                </button>
              </>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 sm:w-auto sm:px-3.5 sm:text-sm"
              >
                <span className="text-lg leading-none">+</span>
                Tambah Surat
              </button>
            )}
          </div>
        }
      />

      <Card className="mb-4">
        <AdvancedFilters
          values={filters}
          onChange={setFilters}
          onSubmit={() => setApplied(filters)}
          onReset={() => {
            setFilters(emptySuratFiltersKeluar);
            setApplied(emptySuratFiltersKeluar);
          }}
          bidangList={bidangList}
          showBidang
          partyLabel="Ditujukan Kepada"
          partyPlaceholder="Contoh: Dinas Pendidikan Provinsi"
          searchPlaceholder="Cari nomor surat, perihal, tujuan…"
          dateFieldOptions={[{ value: "tanggalSurat", label: "Tanggal Surat" }]}
        />
      </Card>

      {showForm && (
        <Card className="mb-5 !p-5 sm:!p-7">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-ink">
                {editId ? "Ubah Surat" : "Tambah Surat"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Silakan tambah surat sesuai dengan dokumen
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
                setFile(null);
              }}
            >
              Tutup
            </Button>
          </div>

          <form onSubmit={onSubmit}>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="No Urut"
                    placeholder="Otomatis saat simpan"
                    value={editId ? String(rows.find((r) => r.id === editId)?.noUrut ?? "") : ""}
                    disabled
                    hint={!editId ? "Diisi otomatis sistem" : undefined}
                  />
                  <Input
                    label="Tanggal Surat"
                    type="date"
                    required
                    value={form.tanggalSurat}
                    onChange={(e) => setForm({ ...form, tanggalSurat: e.target.value })}
                  />
                </div>

                <Input
                  label="No Surat"
                  required
                  placeholder="Masukkan nomor surat disini..."
                  value={form.nomorSurat}
                  onChange={(e) => setForm({ ...form, nomorSurat: e.target.value })}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <AsyncSearchableSelect
                    label="Kode Klasifikasi"
                    required
                    value={form.kodeId}
                    selectedLabel={kodeLabel}
                    placeholder="Cari kode klasifikasi…"
                    searchPlaceholder="Ketik kode atau nama…"
                    onSearch={searchKode}
                    onChange={(v, opt) => {
                      setForm({ ...form, kodeId: v, indeksId: "" });
                      setKodeLabel(opt?.label ?? "");
                    }}
                  />
                  <SearchableSelect
                    label="Sub Indeks"
                    value={form.indeksId}
                    options={indeksOptions}
                    emptyLabel={form.kodeId ? "Tanpa sub indeks" : undefined}
                    placeholder={
                      !form.kodeId
                        ? "Pilih kode dulu"
                        : indeksOptions.length
                          ? "Pilih sub indeks (opsional)"
                          : "Tidak ada sub indeks"
                    }
                    searchPlaceholder="Cari sub indeks…"
                    disabled={!form.kodeId}
                    onChange={(v) => setForm({ ...form, indeksId: v })}
                  />
                </div>

                <Input
                  label="Perihal"
                  required
                  placeholder="Masukkan perihal disini..."
                  value={form.perihal}
                  onChange={(e) => setForm({ ...form, perihal: e.target.value })}
                />

                <Textarea
                  label="Ditujukan Kepada"
                  required
                  rows={3}
                  placeholder={"ex. 1. Dinas Pendidikan Provinsi\n2. Dinas Kesehatan"}
                  value={form.ditujukanKepada}
                  onChange={(e) => setForm({ ...form, ditujukanKepada: e.target.value })}
                  onBlur={() =>
                    setForm((prev) => ({
                      ...prev,
                      ditujukanKepada: splitNomorPerBaris(prev.ditujukanKepada),
                    }))
                  }
                />

                <SearchableSelect
                  label="Pembuat Surat"
                  required
                  value={form.bidangId}
                  options={bidangOptions}
                  placeholder="Pilih bidang pembuat..."
                  searchPlaceholder="Cari bidang…"
                  onChange={(v) => setForm({ ...form, bidangId: v })}
                />

                <Input
                  label="Keterangan"
                  placeholder="ex. Umum, GTK, dsb..."
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                />
              </div>

              <div>
                {!editId ? (
                  <div className="space-y-2">
                    <FileDropzone label="Bukti Surat" file={file} onFile={setFile} />
                    {file?.type.startsWith("image/") && (
                      <Button
                        type="button"
                        variant="accent"
                        size="sm"
                        className="w-full"
                        loading={ocrLoading}
                        disabled={ocrLoading}
                        onClick={autofillFromScan}
                      >
                        {ocrLoading ? "Membaca scan…" : "✨ Isi otomatis dari scan"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                      Bukti Surat
                    </span>
                    <div className="flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 text-center text-sm text-slate-400 dark:border-line dark:bg-canvas/40">
                      File tidak diubah saat edit
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditId(null);
                  setFile(null);
                }}
              >
                Batal
              </Button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? <span className="spinner" /> : <span className="text-lg leading-none">+</span>}
                {editId ? "Simpan Perubahan" : "Tambah Surat"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="spinner" />
        </div>
      ) : !Array.isArray(rows) || rows.length === 0 ? (
        <Empty
          message="Belum ada surat keluar yang tercatat"
          action={
            canCreate ? (
              <Button onClick={openCreate}>Tambah Surat Pertama</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="cards-mobile-only space-y-3">
            {rows.map((r) => (
              <MobileCard
                key={r.id}
                title={r.nomorSurat}
                subtitle={r.perihal}
                meta={
                  <span className="tabular-nums text-[11px] font-semibold text-muted">
                    #{r.noUrut}
                  </span>
                }
                actions={
                  <>
                    {r.hasFile && (
                      <a
                        href={`/api/surat-keluar/${r.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        File
                      </a>
                    )}
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        Ubah
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(r)}
                        className="rounded-lg bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger"
                      >
                        Hapus
                      </button>
                    )}
                  </>
                }
              >
                <FieldRow label="Tgl surat" value={r.tanggalSurat} />
                <FieldRow label="Kode" value={r.kodeKlasifikasi} />
                <FieldRow label="Sub indeks" value={r.indeks || "—"} />
                <FieldRow
                  label="Ditujukan"
                  value={
                    <span className="whitespace-pre-line">
                      {splitNomorPerBaris(r.ditujukanKepada)}
                    </span>
                  }
                />
                <FieldRow label="Pembuat" value={r.pembuatSurat} />
                <FieldRow label="Keterangan" value={r.keterangan || "—"} />
              </MobileCard>
            ))}
          </div>

          <div className="table-desktop-only">
            <Table minWidth="1000px">
              <thead>
                <tr>
                  <th className="px-4 py-3.5">No. Urut</th>
                  <th className="px-4 py-3.5">Tanggal Surat</th>
                  <th className="px-4 py-3.5">No. Surat</th>
                  <th className="px-4 py-3.5">Kode Klasifikasi</th>
                  <th className="px-4 py-3.5">Sub Indeks</th>
                  <th className="px-4 py-3.5">Perihal</th>
                  <th className="px-4 py-3.5">Ditujukan Kepada</th>
                  <th className="px-4 py-3.5">Pembuat Surat</th>
                  <th className="px-4 py-3.5">Keterangan</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-4 tabular-nums font-medium text-slate-700 dark:text-slate-200">
                      {r.noUrut}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {r.tanggalSurat}
                    </td>
                    <td className="max-w-[140px] px-4 py-4 font-medium leading-snug text-slate-700 dark:text-slate-200 whitespace-normal break-words">
                      {r.nomorSurat}
                    </td>
                    <td className="px-4 py-4 tabular-nums text-slate-600 dark:text-slate-300">
                      {r.kodeKlasifikasi?.split(" - ")[0] ?? r.kodeKlasifikasi}
                    </td>
                    <td className="max-w-[200px] px-4 py-4 leading-snug text-slate-600 dark:text-slate-300 whitespace-normal break-words">
                      {r.indeks || "—"}
                    </td>
                    <td
                      className="max-w-[220px] px-4 py-4 leading-snug text-slate-600 dark:text-slate-300 whitespace-normal break-words"
                    >
                      {r.perihal}
                    </td>
                    <td className="max-w-[160px] px-4 py-4 font-medium leading-snug text-slate-700 dark:text-slate-200 whitespace-pre-line break-words">
                      {splitNomorPerBaris(r.ditujukanKepada)}
                    </td>
                    <td className="max-w-[150px] px-4 py-4 leading-snug text-slate-600 dark:text-slate-300 whitespace-normal break-words">
                      {r.pembuatSurat}
                    </td>
                    <td className="max-w-[160px] px-4 py-4 leading-snug text-slate-500 whitespace-normal break-words">
                      {r.keterangan || "—"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {r.hasFile ? (
                          <a
                            href={`/api/surat-keluar/${r.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            title="Lihat file"
                            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-[#dce3ec] bg-white text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#334155] dark:border-line dark:bg-surface dark:text-muted"
                          >
                            <IconEye />
                          </a>
                        ) : (
                          <IconBtn label="Tidak ada file" disabled>
                            <IconEye />
                          </IconBtn>
                        )}
                        {canUpdate && (
                          <IconBtn label="Ubah" onClick={() => openEdit(r)}>
                            <IconEdit />
                          </IconBtn>
                        )}
                        {canDelete && (
                          <IconBtn label="Hapus" tone="danger" onClick={() => setDeleteTarget(r)}>
                            <IconTrash />
                          </IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            perPage={perPage}
            loading={loading}
            onPageChange={(p) => void load(p)}
            onPerPageChange={setPerPage}
          />
        </>
      )}

      <PrintConfigModal
        open={printOpen}
        onClose={() => !printLoading && setPrintOpen(false)}
        onConfirm={(cfg) => void runPrint(cfg)}
        page={meta.page}
        perPage={perPage}
        total={meta.total}
        loading={printLoading}
      />

      <ExportConfigModal
        open={exportOpen}
        onClose={() => !exportLoading && setExportOpen(false)}
        onConfirm={(cfg) => void runExport(cfg)}
        page={meta.page}
        perPage={perPage}
        total={meta.total}
        loading={exportLoading}
      />

      <Modal
        open={!!deleteTarget}
        title="Hapus Surat Keluar?"
        subtitle="Tindakan ini tidak bisa dibatalkan"
        onClose={() => !deleting && setDeleteTarget(null)}
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={deleting}
              onClick={() => void confirmDelete()}
            >
              Ya, Hapus
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600 dark:text-slate-300">Anda akan menghapus surat:</p>
            <div className="rounded-xl border border-line bg-canvas px-4 py-3">
              <p className="font-bold tabular-nums text-ink">#{deleteTarget.noUrut}</p>
              <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
                {deleteTarget.nomorSurat}
              </p>
              <p className="mt-1 text-xs text-muted line-clamp-2">{deleteTarget.perihal}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
