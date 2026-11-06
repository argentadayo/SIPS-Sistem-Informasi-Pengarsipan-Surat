import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, formatApiError } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import {
  Button,
  Card,
  IconBtn,
  IconEdit,
  IconEye,
  IconTrash,
  Input,
  MobileCard,
  Modal,
  Table,
} from "../../../components/ui";
import { emptyBidangForm } from "../constants";
import type { Bidang } from "../types";

type Props = {
  canManage: boolean;
};

export function BidangTab({ canManage }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<Bidang[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyBidangForm);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyBidangForm);
  const [view, setView] = useState<Bidang | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bidang | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<Bidang[]>("/api/master/bidang");
    if (res.data) setRows(res.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await api.post("/api/master/bidang", {
      namaBidang: form.namaBidang.trim(),
      singkatan: form.singkatan.trim(),
      status: true,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal menambah bidang"));
      return;
    }
    toast.success("Bidang berhasil ditambahkan");
    setShowCreate(false);
    setForm(emptyBidangForm);
    void load();
  }

  function openEdit(b: Bidang) {
    setEditId(b.id);
    setEditForm({
      namaBidang: b.namaBidang,
      singkatan: b.singkatan,
      status: b.status,
    });
    setEditOpen(true);
  }

  async function onUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    const res = await api.put(`/api/master/bidang/${editId}`, {
      namaBidang: editForm.namaBidang.trim(),
      singkatan: editForm.singkatan.trim(),
      status: editForm.status,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal memperbarui bidang"));
      return;
    }
    toast.success("Bidang berhasil diperbarui");
    setEditOpen(false);
    setEditId(null);
    void load();
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await api.del(`/api/master/bidang/${deleteTarget.id}`);
    setDeleting(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal menghapus bidang"));
      setDeleteTarget(null);
      return;
    }
    toast.success("Bidang berhasil dihapus");
    setDeleteTarget(null);
    void load();
  }

  return (
    <div className="space-y-4">
      {canManage && showCreate && (
        <Card className="!p-5 sm:!p-7">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-ink">Tambah Bidang</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Unit kerja untuk disposisi / pembuat surat
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
              Tutup
            </Button>
          </div>
          <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Nama bidang"
              required
              value={form.namaBidang}
              onChange={(e) => setForm({ ...form, namaBidang: e.target.value })}
            />
            <Input
              label="Singkatan"
              required
              value={form.singkatan}
              onChange={(e) => setForm({ ...form, singkatan: e.target.value })}
            />
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" loading={saving}>
                Simpan Bidang
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="!p-4 sm:!p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink sm:text-lg">List Bidang</h2>
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setForm(emptyBidangForm);
                setShowCreate(true);
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 sm:w-auto sm:px-3.5 sm:text-sm"
            >
              <span className="text-lg leading-none">+</span>
              Tambah Bidang
            </button>
          )}
        </div>

        {!canManage && (
          <p className="mb-3 text-xs text-muted">
            Daftar bidang (hanya Super Admin yang dapat menambah/mengubah/menghapus).
          </p>
        )}

        <div className="cards-mobile-only space-y-3">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Belum ada bidang</p>
          ) : (
            rows.map((b, idx) => (
              <MobileCard
                key={b.id}
                title={b.namaBidang}
                subtitle={b.singkatan}
                meta={<span className="text-[10px] font-medium text-muted">No. {idx + 1}</span>}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={() => setView(b)}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      Lihat
                    </button>
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(b)}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(b)}
                          className="rounded-lg bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger"
                        >
                          Hapus
                        </button>
                      </>
                    )}
                  </>
                }
              />
            ))
          )}
        </div>

        <div className="table-desktop-only">
          <Table>
            <thead>
              <tr>
                <th className="w-16 px-5 py-3.5">No.</th>
                <th className="px-4 py-3.5">Nama Bidang</th>
                <th className="px-4 py-3.5">Singkatan</th>
                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted">
                    Belum ada bidang
                  </td>
                </tr>
              ) : (
                rows.map((b, idx) => (
                  <tr key={b.id}>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{idx + 1}</td>
                    <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-200">
                      {b.namaBidang}
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{b.singkatan}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <IconBtn label="Lihat Bidang" onClick={() => setView(b)}>
                          <IconEye />
                        </IconBtn>
                        {canManage && (
                          <>
                            <IconBtn label="Edit Bidang" onClick={() => openEdit(b)}>
                              <IconEdit />
                            </IconBtn>
                            <IconBtn
                              label="Hapus Bidang"
                              tone="danger"
                              onClick={() => setDeleteTarget(b)}
                            >
                              <IconTrash />
                            </IconBtn>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      <Modal
        open={!!view}
        title="Detail Bidang"
        subtitle="Informasi bidang"
        onClose={() => setView(null)}
        size="sm"
        footer={
          <Button type="button" variant="secondary" onClick={() => setView(null)}>
            Tutup
          </Button>
        }
      >
        {view && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-line bg-canvas px-4 py-3">
              <p className="text-xs font-medium text-muted">Nama Bidang</p>
              <p className="mt-0.5 font-bold text-ink">{view.namaBidang}</p>
            </div>
            <div className="rounded-xl border border-line bg-canvas px-4 py-3">
              <p className="text-xs font-medium text-muted">Singkatan</p>
              <p className="mt-0.5 font-semibold text-ink">{view.singkatan}</p>
            </div>
            <div className="rounded-xl border border-line bg-canvas px-4 py-3">
              <p className="text-xs font-medium text-muted">Status</p>
              <p className="mt-0.5 font-semibold text-ink">{view.status ? "Aktif" : "Nonaktif"}</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={editOpen}
        title="Edit Bidang"
        subtitle="Perbarui nama, singkatan, dan status bidang"
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="edit-bidang-form" loading={saving}>
              Simpan Perubahan
            </Button>
          </>
        }
      >
        <form id="edit-bidang-form" onSubmit={onUpdate} className="space-y-3">
          <Input
            label="Nama bidang"
            required
            value={editForm.namaBidang}
            onChange={(e) => setEditForm({ ...editForm, namaBidang: e.target.value })}
          />
          <Input
            label="Singkatan"
            required
            value={editForm.singkatan}
            onChange={(e) => setEditForm({ ...editForm, singkatan: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.checked })}
              className="h-4 w-4 rounded border-line"
            />
            Aktif
          </label>
        </form>
      </Modal>

      <Modal
        open={!!deleteTarget}
        title="Hapus Bidang?"
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
            <Button type="button" variant="danger" loading={deleting} onClick={() => void onDelete()}>
              Ya, Hapus
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600 dark:text-slate-300">Anda akan menghapus bidang:</p>
            <div className="rounded-xl border border-line bg-canvas px-4 py-3">
              <p className="font-bold text-ink">{deleteTarget.namaBidang}</p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-300">{deleteTarget.singkatan}</p>
            </div>
            <p className="text-xs text-muted">
              Jika bidang masih dipakai user/surat, hapus akan ditolak — nonaktifkan saja.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
