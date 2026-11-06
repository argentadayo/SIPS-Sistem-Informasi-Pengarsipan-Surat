import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { api, formatApiError } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import {
  AsyncSearchableSelect,
  Button,
  Card,
  FieldRow,
  IconBtn,
  IconEdit,
  IconTrash,
  Input,
  MobileCard,
  Modal,
  Pagination,
  SearchableSelect,
  Table,
  type SearchableSelectOption,
} from "../../../components/ui";
import { emptyIndeksKodeForm, emptySubIndeksForm } from "../constants";
import type { Indeks, Kategori, Kode, PageMeta } from "../types";
import {
  applyKategoriPrefix,
  countDots,
  kategoriToOptions,
  validateKodePrefix,
} from "../validation";

type Props = {
  canManage: boolean;
};

export function IndeksTab({ canManage }: Props) {
  const toast = useToast();
  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [rows, setRows] = useState<Kode[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, totalPages: 1, total: 0 });
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, Indeks[] | "loading" | undefined>>({});

  const [showKodeForm, setShowKodeForm] = useState(false);
  const [kForm, setKForm] = useState(emptyIndeksKodeForm);
  const [editKodeOpen, setEditKodeOpen] = useState(false);
  const [editKodeId, setEditKodeId] = useState<number | null>(null);
  const [editKForm, setEditKForm] = useState(emptyIndeksKodeForm);
  const [deleteKode, setDeleteKode] = useState<Kode | null>(null);

  const [showSubForm, setShowSubForm] = useState(false);
  const [iForm, setIForm] = useState(emptySubIndeksForm);
  const [iFormLabel, setIFormLabel] = useState("");
  const [editSubOpen, setEditSubOpen] = useState(false);
  const [editSubId, setEditSubId] = useState<number | null>(null);
  const [editIForm, setEditIForm] = useState(emptySubIndeksForm);
  const [editILabel, setEditILabel] = useState("");

  const kategoriOptions = useMemo(() => kategoriToOptions(kategori), [kategori]);

  const loadKategori = useCallback(async () => {
    const res = await api.get<Kategori[]>("/api/master/kategori");
    if (res.data) setKategori(res.data);
  }, []);

  const loadKode = useCallback(
    async (page = 1, size = perPage) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(size));
      params.set("kind", "indeks");
      if (searchApplied.trim()) params.set("search", searchApplied.trim());
      if (kategoriFilter) params.set("kategoriId", kategoriFilter);
      const res = await api.get<Kode[]>(`/api/master/kode?${params}`);
      if (res.data) {
        setRows(res.data);
        setMeta({
          page: Number(res.meta?.page ?? page),
          totalPages: Number(res.meta?.totalPages ?? 1),
          total: Number(res.meta?.total ?? 0),
        });
        setExpanded({});
      }
      setLoading(false);
    },
    [searchApplied, kategoriFilter, perPage],
  );

  useEffect(() => {
    void loadKategori();
  }, [loadKategori]);

  useEffect(() => {
    void loadKode(1);
  }, [loadKode]);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchApplied(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const searchKodeOptions = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", "30");
    params.set("forSurat", "1");
    const res = await api.get<{ id: number; kode: string; namaKelompok: string }[]>(
      `/api/master/kode/search?${params}`,
    );
    return (res.data ?? []).map((k) => ({
      value: String(k.id),
      label: `${k.kode} - ${k.namaKelompok}`,
    }));
  }, []);

  async function refreshSub(kodeId: number) {
    if (expanded[kodeId] === undefined) return;
    const r = await api.get<Indeks[]>(`/api/master/indeks?kodeId=${kodeId}`);
    setExpanded((prev) => ({
      ...prev,
      [kodeId]: r.data
        ? [...r.data].sort((a, b) => a.urutanIndeks - b.urutanIndeks)
        : [],
    }));
  }

  async function toggleExpand(kodeId: number) {
    if (expanded[kodeId] !== undefined) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[kodeId];
        return next;
      });
      return;
    }
    setExpanded((prev) => ({ ...prev, [kodeId]: "loading" }));
    const res = await api.get<Indeks[]>(`/api/master/indeks?kodeId=${kodeId}`);
    setExpanded((prev) => ({
      ...prev,
      [kodeId]: res.data
        ? [...res.data].sort((a, b) => a.urutanIndeks - b.urutanIndeks)
        : [],
    }));
  }

  async function addKode(e: FormEvent) {
    e.preventDefault();
    const prefixErr = validateKodePrefix(kategori, kForm.kategoriId, kForm.kode);
    if (prefixErr) {
      toast.error(prefixErr);
      return;
    }
    if (countDots(kForm.kode.trim()) < 2) {
      toast.error(
        "Kode indeks harus 2+ titik (contoh: 000.1.2). Untuk kelompok, buka tab Kategori & Kelompok.",
      );
      return;
    }
    setSaving(true);
    const res = await api.post("/api/master/kode", {
      kategoriId: Number(kForm.kategoriId),
      kode: kForm.kode.trim(),
      namaKelompok: kForm.namaKelompok.trim(),
      hasSubKode: kForm.hasSubKode,
      status: true,
      kind: "indeks",
    });
    setSaving(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal menyimpan kode"));
      return;
    }
    toast.success("Indeks berhasil ditambahkan");
    setShowKodeForm(false);
    setKForm(emptyIndeksKodeForm);
    void loadKode(meta.page);
  }

  async function updateKode(e: FormEvent) {
    e.preventDefault();
    if (!editKodeId) return;
    const prefixErr = validateKodePrefix(kategori, editKForm.kategoriId, editKForm.kode);
    if (prefixErr) {
      toast.error(prefixErr);
      return;
    }
    if (countDots(editKForm.kode.trim()) < 2) {
      toast.error("Kode indeks harus 2+ titik (contoh: 000.1.2)");
      return;
    }
    setSaving(true);
    const res = await api.put(`/api/master/kode/${editKodeId}`, {
      kategoriId: Number(editKForm.kategoriId),
      kode: editKForm.kode.trim(),
      namaKelompok: editKForm.namaKelompok.trim(),
      hasSubKode: editKForm.hasSubKode,
      status: editKForm.status,
      kind: "indeks",
    });
    setSaving(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal memperbarui kode"));
      return;
    }
    toast.success("Kode berhasil diperbarui");
    setEditKodeOpen(false);
    setEditKodeId(null);
    void loadKode(meta.page);
  }

  async function confirmDeleteKode() {
    if (!deleteKode) return;
    setDeleting(true);
    const res = await api.del(`/api/master/kode/${deleteKode.id}`);
    setDeleting(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal menghapus kode"));
      setDeleteKode(null);
      return;
    }
    toast.success("Kode berhasil dihapus");
    setDeleteKode(null);
    void loadKode(meta.page);
  }

  async function toggleKodeStatus(k: Kode) {
    const res = await api.put(`/api/master/kode/${k.id}`, {
      kategoriId: k.kategoriId,
      kode: k.kode,
      namaKelompok: k.namaKelompok,
      hasSubKode: k.hasSubKode,
      status: !k.status,
      kind: "indeks",
    });
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal mengubah status kode"));
      return;
    }
    toast.success(k.status ? "Kode dinonaktifkan" : "Kode diaktifkan");
    void loadKode(meta.page);
  }

  async function addSub(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = {
      kodeId: Number(iForm.kodeId),
      namaIndeks: iForm.namaIndeks.trim(),
      urutanIndeks: Number(iForm.urutanIndeks) || 1,
      status: true,
    };
    const res = await api.post("/api/master/indeks", body);
    setSaving(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal menyimpan sub indeks"));
      return;
    }
    toast.success("Sub indeks berhasil ditambahkan");
    setShowSubForm(false);
    setIForm(emptySubIndeksForm);
    setIFormLabel("");
    void loadKode(meta.page);
    void refreshSub(body.kodeId);
  }

  async function updateSub(e: FormEvent) {
    e.preventDefault();
    if (!editSubId) return;
    setSaving(true);
    const body = {
      kodeId: Number(editIForm.kodeId),
      namaIndeks: editIForm.namaIndeks.trim(),
      urutanIndeks: Number(editIForm.urutanIndeks) || 1,
      status: editIForm.status,
    };
    const res = await api.put(`/api/master/indeks/${editSubId}`, body);
    setSaving(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal memperbarui sub indeks"));
      return;
    }
    toast.success("Sub indeks berhasil diperbarui");
    setEditSubOpen(false);
    setEditSubId(null);
    void loadKode(meta.page);
    void refreshSub(body.kodeId);
  }

  async function deleteSub(i: Indeks, kodeId: number) {
    if (!confirm(`Hapus Sub Indeks "${i.namaIndeks}"?`)) return;
    const res = await api.del(`/api/master/indeks/${i.id}`);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal menghapus sub indeks"));
      return;
    }
    toast.success("Sub indeks berhasil dihapus");
    void loadKode(meta.page);
    void refreshSub(kodeId);
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setKForm(emptyIndeksKodeForm);
              setShowSubForm(false);
              setShowKodeForm(true);
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 sm:w-auto sm:px-3.5 sm:text-sm"
          >
            <span className="text-lg leading-none">+</span>
            Tambah Indeks
          </button>
          <button
            type="button"
            onClick={() => {
              setIForm(emptySubIndeksForm);
              setIFormLabel("");
              setShowKodeForm(false);
              setShowSubForm(true);
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 sm:w-auto sm:px-3.5 sm:text-sm"
          >
            <span className="text-lg leading-none">+</span>
            Tambah Sub Indeks
          </button>
        </div>
      )}

      {!canManage && (
        <p className="text-xs text-muted">
          Daftar kode klasifikasi (hanya Super Admin yang dapat menambah/mengubah/menghapus).
        </p>
      )}

      {canManage && showKodeForm && (
        <Card className="!p-5 sm:!p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-ink">Tambah Indeks</h2>
            <button
              type="button"
              onClick={() => setKForm(emptyIndeksKodeForm)}
              className="text-sm font-medium text-muted hover:text-ink"
            >
              Reset
            </button>
          </div>
          <form onSubmit={addKode}>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <SearchableSelect
                  label="Kategori"
                  required
                  value={kForm.kategoriId}
                  options={kategoriOptions}
                  placeholder="Pilih Kategori"
                  searchPlaceholder="Cari kategori…"
                  onChange={(v) =>
                    setKForm({
                      ...kForm,
                      kategoriId: v,
                      kode: applyKategoriPrefix(kategori, kForm.kategoriId, v, kForm.kode),
                    })
                  }
                />
                <Input
                  label="Kode"
                  required
                  value={kForm.kode}
                  onChange={(e) => setKForm({ ...kForm, kode: e.target.value })}
                  placeholder="Contoh: 000.1.2"
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Indeks"
                    required
                    value={kForm.namaKelompok}
                    onChange={(e) => setKForm({ ...kForm, namaKelompok: e.target.value })}
                    placeholder="Masukan nama indeks…"
                  />
                </div>
              </div>
              <aside className="rounded-2xl border border-line bg-canvas px-4 py-4">
                <p className="mb-2 text-sm font-bold text-ink">Cara penggunaan:</p>
                <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
                  <li>Pilih kategori — prefix otomatis terisi.</li>
                  <li>Lengkapi kode 2+ titik (mis. 1.2 → 100.1.2).</li>
                  <li>Isi nama indeks sesuai pedoman.</li>
                  <li>Kode harus diawali prefix kategori.</li>
                </ul>
              </aside>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowKodeForm(false)}>
                Batal
              </Button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
              >
                {saving ? "Menyimpan…" : "Tambah Indeks"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {canManage && showSubForm && (
        <Card className="!p-5 sm:!p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-ink">Tambah Sub-Indeks</h2>
            <button
              type="button"
              onClick={() => {
                setIForm(emptySubIndeksForm);
                setIFormLabel("");
              }}
              className="text-sm font-medium text-muted hover:text-ink"
            >
              Reset
            </button>
          </div>
          <form onSubmit={addSub}>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <AsyncSearchableSelect
                  label="Indeks (kode)"
                  required
                  value={iForm.kodeId}
                  selectedLabel={iFormLabel}
                  placeholder="Pilih indeks…"
                  searchPlaceholder="Ketik kode atau nama indeks…"
                  onSearch={searchKodeOptions}
                  onChange={(v, opt) => {
                    setIForm({ ...iForm, kodeId: v });
                    setIFormLabel(opt?.label ?? "");
                  }}
                />
                <Input
                  label="Sub-Indeks"
                  required
                  value={iForm.namaIndeks}
                  onChange={(e) => setIForm({ ...iForm, namaIndeks: e.target.value })}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Urutan"
                    required
                    type="number"
                    value={iForm.urutanIndeks}
                    onChange={(e) => setIForm({ ...iForm, urutanIndeks: e.target.value })}
                  />
                </div>
              </div>
              <aside className="rounded-2xl border border-line bg-canvas px-4 py-4">
                <p className="mb-2 text-sm font-bold text-ink">Cara penggunaan:</p>
                <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
                  <li>Pilih indeks (kode, mis. 000.1.2) — bukan kelompok 000.1.</li>
                  <li>Isi nama sub indeks sesuai pedoman.</li>
                  <li>Atur urutan tampilan (1, 2, 3…).</li>
                </ul>
              </aside>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowSubForm(false)}>
                Batal
              </Button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                {saving ? "Menyimpan…" : "Tambah Sub-Indeks"}
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <SearchableSelect
            label="Filter kategori"
            value={kategoriFilter}
            options={kategoriOptions}
            emptyLabel="Semua kategori"
            placeholder="Semua kategori"
            searchPlaceholder="Cari kategori…"
            onChange={setKategoriFilter}
          />
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-200">
              Cari kode
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kode atau nama…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:border-line dark:bg-surface dark:text-ink"
            />
          </div>
        </div>
        <p className="text-xs text-muted sm:text-right">
          {loading ? "Memuat…" : (
            <>
              Halaman <strong className="text-ink">{meta.page}</strong> · {meta.total} kode
            </>
          )}
        </p>
      </div>

      <div className="cards-mobile-only space-y-3">
        {loading && rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Memuat data…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Tidak ada kode klasifikasi</p>
        ) : (
          rows.map((k) => {
            const exp = expanded[k.id];
            const open = exp !== undefined;
            const count = k._count?.indeks ?? 0;
            const kodeLabel = `${k.kode} - ${k.namaKelompok}`;
            return (
              <div key={k.id} className="space-y-2">
                <MobileCard
                  title={k.kode}
                  subtitle={k.namaKelompok}
                  meta={
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        k.status ? "bg-slate-100 text-slate-600" : "bg-slate-50 text-slate-400"
                      }`}
                    >
                      {k.status ? "Aktif" : "Nonaktif"}
                    </span>
                  }
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => void toggleExpand(k.id)}
                        disabled={count === 0 && !open}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
                      >
                        {open ? "Tutup sub" : count > 0 ? `${count} sub` : "Sub"}
                      </button>
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditKodeId(k.id);
                              setEditKForm({
                                kategoriId: String(k.kategoriId),
                                kode: k.kode,
                                namaKelompok: k.namaKelompok,
                                hasSubKode: k.hasSubKode,
                                status: k.status,
                              });
                              setEditKodeOpen(true);
                            }}
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteKode(k)}
                            className="rounded-lg bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger"
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </>
                  }
                >
                  <FieldRow
                    label="Kategori"
                    value={
                      k.kategori ? `${k.kategori.kodeAwal} · ${k.kategori.namaKategori}` : "—"
                    }
                  />
                  <FieldRow
                    label="Kelompok"
                    value={
                      k.kelompok ? `${k.kelompok.kode} · ${k.kelompok.namaKelompok}` : "—"
                    }
                  />
                  <FieldRow label="Sub indeks" value={count > 0 ? `${count} item` : "—"} />
                </MobileCard>
                {open && (
                  <div className="rounded-xl border border-line bg-canvas/60 px-4 py-3">
                    {exp === "loading" ? (
                      <p className="text-sm text-muted">Memuat sub indeks…</p>
                    ) : !exp || exp.length === 0 ? (
                      <p className="text-sm text-muted">Tidak ada sub indeks</p>
                    ) : (
                      <ul className="space-y-2">
                        {exp.map((i) => (
                          <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                            <span className={i.status ? "text-slate-600" : "text-slate-400 line-through"}>
                              <span className="mr-1 tabular-nums text-slate-400">{i.urutanIndeks}.</span>
                              {i.namaIndeks}
                            </span>
                            {canManage && (
                              <span className="inline-flex gap-1">
                                <IconBtn
                                  label="Edit"
                                  onClick={() => {
                                    setEditSubId(i.id);
                                    setEditIForm({
                                      kodeId: String(k.id),
                                      namaIndeks: i.namaIndeks,
                                      urutanIndeks: String(i.urutanIndeks),
                                      status: i.status,
                                    });
                                    setEditILabel(kodeLabel);
                                    setEditSubOpen(true);
                                  }}
                                >
                                  <IconEdit />
                                </IconBtn>
                                <IconBtn
                                  label="Hapus"
                                  tone="danger"
                                  onClick={() => void deleteSub(i, k.id)}
                                >
                                  <IconTrash />
                                </IconBtn>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="table-desktop-only">
        <Table minWidth="900px">
          <thead>
            <tr>
              <th className="w-10 px-3 py-3.5" />
              <th className="px-4 py-3.5">Kode</th>
              <th className="px-4 py-3.5">Kategori</th>
              <th className="px-4 py-3.5">Kelompok</th>
              <th className="px-4 py-3.5">Indeks</th>
              <th className="px-4 py-3.5">Sub Indeks</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted">
                  Memuat data…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted">
                  Tidak ada kode klasifikasi
                </td>
              </tr>
            ) : (
              rows.map((k) => {
                const exp = expanded[k.id];
                const open = exp !== undefined;
                const count = k._count?.indeks ?? 0;
                const kodeLabel = `${k.kode} - ${k.namaKelompok}`;
                return (
                  <Fragment key={k.id}>
                    <tr className="align-top">
                      <td className="px-3 py-4">
                        <button
                          type="button"
                          onClick={() => void toggleExpand(k.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-muted hover:bg-canvas"
                          disabled={count === 0 && !open}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            className={`transition ${open ? "rotate-90" : ""}`}
                          >
                            <path
                              d="m9 6 6 6-6 6"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </td>
                      <td className="px-4 py-4 font-semibold tabular-nums">{k.kode}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {k.kategori
                          ? `${k.kategori.kodeAwal} · ${k.kategori.namaKategori}`
                          : "—"}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {k.kelompok ? (
                          <span>
                            <span className="font-semibold tabular-nums text-slate-600">
                              {k.kelompok.kode}
                            </span>
                            <span className="mt-0.5 block max-w-[180px] text-[11px] leading-snug text-muted whitespace-normal break-words">
                              {k.kelompok.namaKelompok}
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <p className="max-w-[280px] font-medium leading-snug whitespace-normal break-words">
                          {k.namaKelompok}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        {count > 0 ? `${count} sub indeks` : "—"}
                      </td>
                      <td className="px-4 py-4">
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => void toggleKodeStatus(k)}
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              k.status
                                ? "bg-slate-100 text-slate-600"
                                : "bg-slate-50 text-slate-400"
                            }`}
                          >
                            {k.status ? "Aktif" : "Nonaktif"}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              k.status
                                ? "bg-slate-100 text-slate-600"
                                : "bg-slate-50 text-slate-400"
                            }`}
                          >
                            {k.status ? "Aktif" : "Nonaktif"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {canManage ? (
                          <div className="flex justify-center gap-1.5">
                            <IconBtn
                              label="Edit"
                              onClick={() => {
                                setEditKodeId(k.id);
                                setEditKForm({
                                  kategoriId: String(k.kategoriId),
                                  kode: k.kode,
                                  namaKelompok: k.namaKelompok,
                                  hasSubKode: k.hasSubKode,
                                  status: k.status,
                                });
                                setEditKodeOpen(true);
                              }}
                            >
                              <IconEdit />
                            </IconBtn>
                            <IconBtn label="Hapus" tone="danger" onClick={() => setDeleteKode(k)}>
                              <IconTrash />
                            </IconBtn>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} className="bg-canvas/60 px-8 py-3">
                          {exp === "loading" ? (
                            <p className="text-sm text-muted">Memuat sub indeks…</p>
                          ) : !exp || exp.length === 0 ? (
                            <p className="text-sm text-muted">Tidak ada sub indeks</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {exp.map((i) => (
                                <li
                                  key={i.id}
                                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                                >
                                  <span
                                    className={
                                      i.status ? "text-slate-600" : "text-slate-400 line-through"
                                    }
                                  >
                                    <span className="mr-1 tabular-nums text-slate-400">
                                      {i.urutanIndeks}.
                                    </span>
                                    {i.namaIndeks}
                                  </span>
                                  {canManage && (
                                    <span className="inline-flex gap-1">
                                      <IconBtn
                                        label="Edit"
                                        onClick={() => {
                                          setEditSubId(i.id);
                                          setEditIForm({
                                            kodeId: String(k.id),
                                            namaIndeks: i.namaIndeks,
                                            urutanIndeks: String(i.urutanIndeks),
                                            status: i.status,
                                          });
                                          setEditILabel(kodeLabel);
                                          setEditSubOpen(true);
                                        }}
                                      >
                                        <IconEdit />
                                      </IconBtn>
                                      <IconBtn
                                        label="Hapus"
                                        tone="danger"
                                        onClick={() => void deleteSub(i, k.id)}
                                      >
                                        <IconTrash />
                                      </IconBtn>
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </Table>
      </div>

      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        perPage={perPage}
        loading={loading}
        onPageChange={(p) => void loadKode(p)}
        onPerPageChange={setPerPage}
      />

      <Modal
        open={editKodeOpen}
        title="Edit Kode Klasifikasi"
        onClose={() => setEditKodeOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setEditKodeOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="edit-kode-form" loading={saving}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="edit-kode-form" onSubmit={updateKode} className="space-y-3">
          <SearchableSelect
            label="Kategori"
            required
            value={editKForm.kategoriId}
            options={kategoriOptions}
            placeholder="Pilih kategori"
            searchPlaceholder="Cari kategori…"
            onChange={(v) =>
              setEditKForm({
                ...editKForm,
                kategoriId: v,
                kode: applyKategoriPrefix(
                  kategori,
                  editKForm.kategoriId,
                  v,
                  editKForm.kode,
                ),
              })
            }
          />
          <Input
            label="Kode"
            required
            value={editKForm.kode}
            onChange={(e) => setEditKForm({ ...editKForm, kode: e.target.value })}
          />
          <Input
            label="Indeks"
            required
            value={editKForm.namaKelompok}
            onChange={(e) => setEditKForm({ ...editKForm, namaKelompok: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editKForm.status}
              onChange={(e) => setEditKForm({ ...editKForm, status: e.target.checked })}
              className="h-4 w-4 rounded border-line"
            />
            Aktif
          </label>
        </form>
      </Modal>

      <Modal
        open={!!deleteKode}
        title="Hapus Kode?"
        onClose={() => !deleting && setDeleteKode(null)}
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={deleting}
              onClick={() => setDeleteKode(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={deleting}
              onClick={() => void confirmDeleteKode()}
            >
              Ya, Hapus
            </Button>
          </>
        }
      >
        {deleteKode && (
          <div className="space-y-2 text-sm">
            <p className="font-bold tabular-nums">{deleteKode.kode}</p>
            <p>{deleteKode.namaKelompok}</p>
            {(deleteKode._count?.indeks ?? 0) > 0 && (
              <p className="text-xs text-muted">
                {deleteKode._count!.indeks} sub indeks di bawahnya juga ikut terhapus.
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={editSubOpen}
        title="Edit Sub Indeks"
        onClose={() => setEditSubOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setEditSubOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="edit-sub-form" loading={saving}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="edit-sub-form" onSubmit={updateSub} className="space-y-3">
          <AsyncSearchableSelect
            label="Indeks (kode)"
            required
            value={editIForm.kodeId}
            selectedLabel={editILabel}
            placeholder="Cari indeks…"
            searchPlaceholder="Ketik kode atau nama indeks…"
            onSearch={searchKodeOptions}
            onChange={(v, opt) => {
              setEditIForm({ ...editIForm, kodeId: v });
              setEditILabel(opt?.label ?? "");
            }}
          />
          <Input
            label="Sub indeks"
            required
            value={editIForm.namaIndeks}
            onChange={(e) => setEditIForm({ ...editIForm, namaIndeks: e.target.value })}
          />
          <Input
            label="Urutan"
            type="number"
            value={editIForm.urutanIndeks}
            onChange={(e) => setEditIForm({ ...editIForm, urutanIndeks: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editIForm.status}
              onChange={(e) => setEditIForm({ ...editIForm, status: e.target.checked })}
              className="h-4 w-4 rounded border-line"
            />
            Aktif
          </label>
        </form>
      </Modal>
    </div>
  );
}
