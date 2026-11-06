import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, formatApiError } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import {
  Button,
  Card,
  IconBtn,
  IconEdit,
  IconTrash,
  Input,
  Modal,
  Pagination,
  SearchableSelect,
  Table,
} from "../../../components/ui";
import { emptyKategoriForm, emptyKelompokForm } from "../constants";
import type { Kategori, Kode, PageMeta, StrukturSub } from "../types";
import {
  applyKategoriPrefix,
  countDots,
  kategoriToOptions,
  validateKategoriKodeAwal,
  validateKodePrefix,
} from "../validation";

type Props = {
  initialSub?: StrukturSub;
};

export function StrukturTab({ initialSub = "kategori" }: Props) {
  const toast = useToast();
  const [sub, setSub] = useState<StrukturSub>(initialSub);
  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [kelompok, setKelompok] = useState<Kode[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, totalPages: 1, total: 0 });
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showKatForm, setShowKatForm] = useState(false);
  const [katForm, setKatForm] = useState(emptyKategoriForm);
  const [editKatOpen, setEditKatOpen] = useState(false);
  const [editKatId, setEditKatId] = useState<number | null>(null);
  const [editKatForm, setEditKatForm] = useState(emptyKategoriForm);
  const [deleteKat, setDeleteKat] = useState<Kategori | null>(null);

  const [showKelForm, setShowKelForm] = useState(false);
  const [kelForm, setKelForm] = useState(emptyKelompokForm);
  const [editKelOpen, setEditKelOpen] = useState(false);
  const [editKelId, setEditKelId] = useState<number | null>(null);
  const [editKelForm, setEditKelForm] = useState(emptyKelompokForm);
  const [deleteKel, setDeleteKel] = useState<Kode | null>(null);

  const kategoriOptions = useMemo(() => kategoriToOptions(kategori), [kategori]);

  const loadKategori = useCallback(async () => {
    const res = await api.get<Kategori[]>("/api/master/kategori");
    if (res.data) setKategori(res.data);
  }, []);

  const loadKelompok = useCallback(
    async (page = 1, size = perPage) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(size));
      params.set("kind", "kelompok");
      if (searchApplied.trim()) params.set("search", searchApplied.trim());
      if (kategoriFilter) params.set("kategoriId", kategoriFilter);
      const res = await api.get<Kode[]>(`/api/master/kode?${params}`);
      if (res.data) {
        setKelompok(res.data);
        setMeta({
          page: Number(res.meta?.page ?? page),
          totalPages: Number(res.meta?.totalPages ?? 1),
          total: Number(res.meta?.total ?? 0),
        });
      }
      setLoading(false);
    },
    [searchApplied, kategoriFilter, perPage],
  );

  useEffect(() => {
    void loadKategori();
  }, [loadKategori]);

  useEffect(() => {
    if (sub === "kelompok") void loadKelompok(1);
  }, [sub, loadKelompok]);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchApplied(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  async function addKategori(e: FormEvent) {
    e.preventDefault();
    const err = validateKategoriKodeAwal(katForm.kodeAwal);
    if (err) {
      toast.error(err);
      return;
    }
    if (katForm.namaKategori.trim().length < 2) {
      toast.error("Nama kategori minimal 2 karakter");
      return;
    }
    setSaving(true);
    const res = await api.post("/api/master/kategori", {
      kodeAwal: katForm.kodeAwal.trim(),
      namaKategori: katForm.namaKategori.trim(),
      status: true,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal menyimpan kategori"));
      return;
    }
    toast.success("Kategori berhasil ditambahkan");
    setShowKatForm(false);
    setKatForm(emptyKategoriForm);
    void loadKategori();
  }

  async function updateKategori(e: FormEvent) {
    e.preventDefault();
    if (!editKatId) return;
    const err = validateKategoriKodeAwal(editKatForm.kodeAwal);
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const res = await api.put(`/api/master/kategori/${editKatId}`, {
      kodeAwal: editKatForm.kodeAwal.trim(),
      namaKategori: editKatForm.namaKategori.trim(),
      status: editKatForm.status,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal memperbarui kategori"));
      return;
    }
    toast.success("Kategori berhasil diperbarui");
    setEditKatOpen(false);
    setEditKatId(null);
    void loadKategori();
  }

  async function confirmDeleteKategori() {
    if (!deleteKat) return;
    setDeleting(true);
    const res = await api.del(`/api/master/kategori/${deleteKat.id}`);
    setDeleting(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal menghapus kategori"));
      setDeleteKat(null);
      return;
    }
    toast.success("Kategori berhasil dihapus");
    setDeleteKat(null);
    void loadKategori();
  }

  async function toggleKategoriStatus(k: Kategori) {
    const res = await api.put(`/api/master/kategori/${k.id}`, {
      kodeAwal: k.kodeAwal,
      namaKategori: k.namaKategori,
      status: !k.status,
    });
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal mengubah status kategori"));
      return;
    }
    void loadKategori();
  }

  async function addKelompok(e: FormEvent) {
    e.preventDefault();
    const prefixErr = validateKodePrefix(kategori, kelForm.kategoriId, kelForm.kode);
    if (prefixErr) {
      toast.error(prefixErr);
      return;
    }
    if (countDots(kelForm.kode.trim()) !== 1) {
      toast.error("Kode kelompok harus 1 titik (contoh: 000.1, 200.2)");
      return;
    }
    if (kelForm.namaKelompok.trim().length < 2) {
      toast.error("Nama kelompok minimal 2 karakter");
      return;
    }
    setSaving(true);
    const res = await api.post("/api/master/kode", {
      kategoriId: Number(kelForm.kategoriId),
      kode: kelForm.kode.trim(),
      namaKelompok: kelForm.namaKelompok.trim(),
      hasSubKode: true,
      status: true,
      kind: "kelompok",
    });
    setSaving(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal menyimpan kelompok"));
      return;
    }
    toast.success("Kelompok berhasil ditambahkan");
    setShowKelForm(false);
    setKelForm(emptyKelompokForm);
    void loadKelompok(meta.page);
  }

  async function updateKelompok(e: FormEvent) {
    e.preventDefault();
    if (!editKelId) return;
    const prefixErr = validateKodePrefix(kategori, editKelForm.kategoriId, editKelForm.kode);
    if (prefixErr) {
      toast.error(prefixErr);
      return;
    }
    if (countDots(editKelForm.kode.trim()) !== 1) {
      toast.error("Kode kelompok harus 1 titik (contoh: 000.1, 200.2)");
      return;
    }
    setSaving(true);
    const res = await api.put(`/api/master/kode/${editKelId}`, {
      kategoriId: Number(editKelForm.kategoriId),
      kode: editKelForm.kode.trim(),
      namaKelompok: editKelForm.namaKelompok.trim(),
      hasSubKode: true,
      status: editKelForm.status,
      kind: "kelompok",
    });
    setSaving(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal memperbarui kelompok"));
      return;
    }
    toast.success("Kelompok berhasil diperbarui");
    setEditKelOpen(false);
    setEditKelId(null);
    void loadKelompok(meta.page);
  }

  async function confirmDeleteKelompok() {
    if (!deleteKel) return;
    setDeleting(true);
    const res = await api.del(`/api/master/kode/${deleteKel.id}`);
    setDeleting(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal menghapus kelompok"));
      setDeleteKel(null);
      return;
    }
    toast.success("Kelompok berhasil dihapus");
    setDeleteKel(null);
    void loadKelompok(meta.page);
  }

  async function toggleKelompokStatus(k: Kode) {
    const res = await api.put(`/api/master/kode/${k.id}`, {
      kategoriId: k.kategoriId,
      kode: k.kode,
      namaKelompok: k.namaKelompok,
      hasSubKode: k.hasSubKode,
      status: !k.status,
      kind: "kelompok",
    });
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal mengubah status kelompok"));
      return;
    }
    void loadKelompok(meta.page);
  }

  return (
    <div className="space-y-4">
      <div className="flex w-full rounded-full border border-line bg-surface p-1 shadow-sm sm:inline-flex sm:w-auto">
        <button
          type="button"
          onClick={() => {
            setSub("kategori");
            setShowKelForm(false);
          }}
          className={`min-h-9 flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition sm:flex-none ${
            sub === "kategori" ? "bg-violet-500 text-white shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          Kategori
        </button>
        <button
          type="button"
          onClick={() => {
            setSub("kelompok");
            setShowKatForm(false);
          }}
          className={`min-h-9 flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition sm:flex-none ${
            sub === "kelompok" ? "bg-amber-500 text-white shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          Kelompok
        </button>
      </div>

      {sub === "kategori" && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setKatForm(emptyKategoriForm);
                setShowKatForm(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-600"
            >
              <span className="text-lg leading-none">+</span>
              Tambah Kategori
            </button>
          </div>

          {showKatForm && (
            <Card className="!p-5 sm:!p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-ink">Tambah Kategori</h2>
                <button
                  type="button"
                  onClick={() => setKatForm(emptyKategoriForm)}
                  className="text-sm font-medium text-muted hover:text-ink"
                >
                  Reset
                </button>
              </div>
              <form onSubmit={addKategori}>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Kode awal"
                      required
                      value={katForm.kodeAwal}
                      onChange={(e) => setKatForm({ ...katForm, kodeAwal: e.target.value })}
                      placeholder="Contoh: 000, 100, 200"
                      maxLength={5}
                    />
                    <Input
                      label="Nama kategori"
                      required
                      value={katForm.namaKategori}
                      onChange={(e) => setKatForm({ ...katForm, namaKategori: e.target.value })}
                      placeholder="Contoh: UMUM, PEMERINTAHAN"
                    />
                  </div>
                  <aside className="rounded-2xl border border-line bg-canvas px-4 py-4">
                    <p className="mb-2 text-sm font-bold text-ink">Cara penggunaan:</p>
                    <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
                      <li>
                        <strong>Kode awal</strong> 3 digit (000, 100, 200…) sesuai pedoman.
                      </li>
                      <li>
                        <strong>Nama kategori</strong> sesuai referensi arsip.
                      </li>
                      <li>Setelah disimpan, muncul di filter & form indeks/kelompok.</li>
                    </ul>
                  </aside>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setShowKatForm(false)}>
                    Batal
                  </Button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-60"
                  >
                    {saving ? "Menyimpan…" : "Tambah Kategori"}
                  </button>
                </div>
              </form>
            </Card>
          )}

          <Card className="!p-0 overflow-hidden">
            <Table minWidth="640px">
              <thead>
                <tr>
                  <th className="px-4 py-3.5">Kode Awal</th>
                  <th className="px-4 py-3.5">Nama Kategori</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {kategori.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted">
                      Belum ada kategori
                    </td>
                  </tr>
                ) : (
                  kategori.map((k) => (
                    <tr key={k.id}>
                      <td className="px-4 py-4 font-semibold tabular-nums">{k.kodeAwal}</td>
                      <td className="px-4 py-4 font-medium">{k.namaKategori}</td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => void toggleKategoriStatus(k)}
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            k.status
                              ? "bg-slate-100 text-slate-600"
                              : "bg-slate-50 text-slate-400"
                          }`}
                        >
                          {k.status ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-1.5">
                          <IconBtn
                            label="Edit"
                            onClick={() => {
                              setEditKatId(k.id);
                              setEditKatForm({
                                kodeAwal: k.kodeAwal,
                                namaKategori: k.namaKategori,
                                status: k.status,
                              });
                              setEditKatOpen(true);
                            }}
                          >
                            <IconEdit />
                          </IconBtn>
                          <IconBtn label="Hapus" tone="danger" onClick={() => setDeleteKat(k)}>
                            <IconTrash />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Card>
        </div>
      )}

      {sub === "kelompok" && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setKelForm(emptyKelompokForm);
                setShowKelForm(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
            >
              <span className="text-lg leading-none">+</span>
              Tambah Kelompok
            </button>
          </div>

          {showKelForm && (
            <Card className="!p-5 sm:!p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-ink">Tambah Kelompok</h2>
                <button
                  type="button"
                  onClick={() => setKelForm(emptyKelompokForm)}
                  className="text-sm font-medium text-muted hover:text-ink"
                >
                  Reset
                </button>
              </div>
              <form onSubmit={addKelompok}>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SearchableSelect
                      label="Kategori"
                      required
                      value={kelForm.kategoriId}
                      options={kategoriOptions}
                      placeholder="Pilih Kategori"
                      searchPlaceholder="Cari kategori…"
                      onChange={(v) =>
                        setKelForm({
                          ...kelForm,
                          kategoriId: v,
                          kode: applyKategoriPrefix(
                            kategori,
                            kelForm.kategoriId,
                            v,
                            kelForm.kode,
                          ),
                        })
                      }
                    />
                    <Input
                      label="Kode kelompok"
                      required
                      value={kelForm.kode}
                      onChange={(e) => setKelForm({ ...kelForm, kode: e.target.value })}
                      placeholder="Contoh: 000.1"
                    />
                    <div className="sm:col-span-2">
                      <Input
                        label="Nama kelompok"
                        required
                        value={kelForm.namaKelompok}
                        onChange={(e) => setKelForm({ ...kelForm, namaKelompok: e.target.value })}
                      />
                    </div>
                  </div>
                  <aside className="rounded-2xl border border-line bg-canvas px-4 py-4">
                    <p className="mb-2 text-sm font-bold text-ink">Cara penggunaan:</p>
                    <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
                      <li>Pilih kategori — prefix otomatis terisi.</li>
                      <li>Kode tepat 1 titik (mis. 100.1), bukan 100.1.2.</li>
                      <li>Kelompok tidak muncul di opsi surat.</li>
                    </ul>
                  </aside>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setShowKelForm(false)}>
                    Batal
                  </Button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                  >
                    {saving ? "Menyimpan…" : "Tambah Kelompok"}
                  </button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
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
                Cari kelompok
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

          <Card className="!p-0 overflow-hidden">
            <Table minWidth="720px">
              <thead>
                <tr>
                  <th className="px-4 py-3.5">Kode</th>
                  <th className="px-4 py-3.5">Kategori</th>
                  <th className="px-4 py-3.5">Nama Kelompok</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading && kelompok.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                      Memuat data…
                    </td>
                  </tr>
                ) : kelompok.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                      Belum ada kelompok
                    </td>
                  </tr>
                ) : (
                  kelompok.map((k) => (
                    <tr key={k.id} className="align-top">
                      <td className="px-4 py-4 font-semibold tabular-nums">{k.kode}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {k.kategori
                          ? `${k.kategori.kodeAwal} · ${k.kategori.namaKategori}`
                          : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <p className="max-w-[320px] font-medium leading-snug whitespace-normal break-words">
                          {k.namaKelompok}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => void toggleKelompokStatus(k)}
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            k.status
                              ? "bg-slate-100 text-slate-600"
                              : "bg-slate-50 text-slate-400"
                          }`}
                        >
                          {k.status ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-1.5">
                          <IconBtn
                            label="Edit"
                            onClick={() => {
                              setEditKelId(k.id);
                              setEditKelForm({
                                kategoriId: String(k.kategoriId),
                                kode: k.kode,
                                namaKelompok: k.namaKelompok,
                                status: k.status,
                              });
                              setEditKelOpen(true);
                            }}
                          >
                            <IconEdit />
                          </IconBtn>
                          <IconBtn label="Hapus" tone="danger" onClick={() => setDeleteKel(k)}>
                            <IconTrash />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Card>

          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            perPage={perPage}
            loading={loading}
            onPageChange={(p) => void loadKelompok(p)}
            onPerPageChange={setPerPage}
          />
        </div>
      )}

      <Modal
        open={editKatOpen}
        title="Edit Kategori"
        onClose={() => setEditKatOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setEditKatOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="edit-kategori-form" loading={saving}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="edit-kategori-form" onSubmit={updateKategori} className="space-y-3">
          <Input
            label="Kode awal"
            required
            value={editKatForm.kodeAwal}
            onChange={(e) => setEditKatForm({ ...editKatForm, kodeAwal: e.target.value })}
            maxLength={5}
          />
          <Input
            label="Nama kategori"
            required
            value={editKatForm.namaKategori}
            onChange={(e) => setEditKatForm({ ...editKatForm, namaKategori: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editKatForm.status}
              onChange={(e) => setEditKatForm({ ...editKatForm, status: e.target.checked })}
              className="h-4 w-4 rounded border-line"
            />
            Aktif
          </label>
        </form>
      </Modal>

      <Modal
        open={!!deleteKat}
        title="Hapus Kategori?"
        onClose={() => !deleting && setDeleteKat(null)}
        size="sm"
        footer={
          <>
            <Button type="button" variant="secondary" disabled={deleting} onClick={() => setDeleteKat(null)}>
              Batal
            </Button>
            <Button type="button" variant="danger" loading={deleting} onClick={() => void confirmDeleteKategori()}>
              Ya, Hapus
            </Button>
          </>
        }
      >
        {deleteKat && (
          <div className="space-y-2 text-sm">
            <p className="font-bold tabular-nums">{deleteKat.kodeAwal}</p>
            <p>{deleteKat.namaKategori}</p>
            <p className="text-xs text-muted">
              Jika masih dipakai kode/kelompok, hapus ditolak — nonaktifkan saja.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={editKelOpen}
        title="Edit Kelompok"
        onClose={() => setEditKelOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setEditKelOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="edit-kelompok-form" loading={saving}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="edit-kelompok-form" onSubmit={updateKelompok} className="space-y-3">
          <SearchableSelect
            label="Kategori"
            required
            value={editKelForm.kategoriId}
            options={kategoriOptions}
            placeholder="Pilih kategori"
            searchPlaceholder="Cari kategori…"
            onChange={(v) =>
              setEditKelForm({
                ...editKelForm,
                kategoriId: v,
                kode: applyKategoriPrefix(
                  kategori,
                  editKelForm.kategoriId,
                  v,
                  editKelForm.kode,
                ),
              })
            }
          />
          <Input
            label="Kode kelompok"
            required
            value={editKelForm.kode}
            onChange={(e) => setEditKelForm({ ...editKelForm, kode: e.target.value })}
          />
          <Input
            label="Nama kelompok"
            required
            value={editKelForm.namaKelompok}
            onChange={(e) => setEditKelForm({ ...editKelForm, namaKelompok: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editKelForm.status}
              onChange={(e) => setEditKelForm({ ...editKelForm, status: e.target.checked })}
              className="h-4 w-4 rounded border-line"
            />
            Aktif
          </label>
        </form>
      </Modal>

      <Modal
        open={!!deleteKel}
        title="Hapus Kelompok?"
        onClose={() => !deleting && setDeleteKel(null)}
        size="sm"
        footer={
          <>
            <Button type="button" variant="secondary" disabled={deleting} onClick={() => setDeleteKel(null)}>
              Batal
            </Button>
            <Button type="button" variant="danger" loading={deleting} onClick={() => void confirmDeleteKelompok()}>
              Ya, Hapus
            </Button>
          </>
        }
      >
        {deleteKel && (
          <div className="space-y-2 text-sm">
            <p className="font-bold tabular-nums">{deleteKel.kode}</p>
            <p>{deleteKel.namaKelompok}</p>
            <p className="text-xs text-muted">
              Jika masih dipakai surat/indeks, hapus ditolak — nonaktifkan saja.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
