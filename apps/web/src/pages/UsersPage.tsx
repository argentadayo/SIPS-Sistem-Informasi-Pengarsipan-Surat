import { useEffect, useState, type FormEvent } from "react";
import { api, can, formatApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import {
  Button,
  Card,
  FieldRow,
  IconBtn,
  IconEdit,
  IconTrash,
  Input,
  MobileCard,
  Modal,
  PageHeader,
  Select,
  Table,
} from "../components/ui";

type UserRow = {
  id: number;
  nama: string;
  username: string;
  email: string;
  status: boolean;
  roleId: number;
  bidangId: number | null;
  role: { name: string };
  bidang: { namaBidang: string } | null;
};

type Role = { id: number; name: string };
type Bidang = { id: number; namaBidang: string };

const emptyForm = {
  nama: "",
  username: "",
  email: "",
  password: "",
  roleId: "",
  bidangId: "",
  status: true,
};

export function UsersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const allowed = can(user, "user.manage");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [bidang, setBidang] = useState<Bidang[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  /** Super Admin tidak boleh ditambahkan/dipilih lewat form */
  const assignableRoles = roles.filter((r) => r.name !== "Super Admin");

  function canRevokeSessions(r: UserRow) {
    if (r.role.name === "Super Admin" && user?.id !== r.id) return false;
    return true;
  }

  async function revokeSessions(r: UserRow) {
    if (!canRevokeSessions(r)) {
      toast.error("Tidak dapat mencabut sesi Super Admin lain");
      return;
    }
    if (
      !window.confirm(
        `Cabut semua sesi login untuk ${r.nama}? User harus login ulang di semua perangkat.`,
      )
    ) {
      return;
    }
    setRevokingId(r.id);
    const res = await api.post<{ count?: number }>(`/api/master/users/${r.id}/revoke-sessions`);
    setRevokingId(null);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal mencabut sesi"));
      return;
    }
    const n = res.data?.count ?? 0;
    toast.success(n ? `${n} sesi diakhiri` : "Tidak ada sesi aktif");
  }

  async function load() {
    const [u, r, b] = await Promise.all([
      api.get<UserRow[]>("/api/master/users"),
      api.get<Role[]>("/api/master/roles"),
      api.get<Bidang[]>("/api/master/bidang"),
    ]);
    if (u.data) setRows(u.data);
    if (r.data) setRoles(r.data);
    if (b.data) setBidang(b.data);
  }

  useEffect(() => {
    if (allowed) void load();
  }, [allowed]);

  function openCreate() {
    setForm(emptyForm);
    setShowForm(true);
  }

  function closeCreate() {
    setShowForm(false);
    setForm(emptyForm);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await api.post("/api/master/users", {
      nama: form.nama,
      username: form.username,
      email: form.email,
      password: form.password,
      roleId: Number(form.roleId),
      bidangId: form.bidangId ? Number(form.bidangId) : null,
      status: true,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal menambah pengguna"));
      return;
    }
    toast.success("Pengguna berhasil ditambahkan");
    closeCreate();
    load();
  }

  function openEdit(r: UserRow) {
    if (r.role.name === "Super Admin") {
      toast.error("Akun Super Admin tidak dapat diubah");
      return;
    }
    setEditId(r.id);
    setEditForm({
      nama: r.nama,
      username: r.username,
      email: r.email,
      password: "",
      roleId: String(r.roleId),
      bidangId: r.bidangId ? String(r.bidangId) : "",
      status: r.status,
    });
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditId(null);
    setEditForm(emptyForm);
  }

  async function onUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      nama: editForm.nama,
      username: editForm.username,
      email: editForm.email,
      roleId: Number(editForm.roleId),
      bidangId: editForm.bidangId ? Number(editForm.bidangId) : null,
      status: editForm.status,
    };
    if (editForm.password.trim()) {
      body.password = editForm.password;
    }
    const res = await api.put(`/api/master/users/${editId}`, body);
    setSaving(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal memperbarui pengguna"));
      return;
    }
    toast.success("Pengguna berhasil diperbarui");
    closeEdit();
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await api.del(`/api/master/users/${deleteTarget.id}`);
    setDeleting(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal menghapus pengguna"));
      setDeleteTarget(null);
      return;
    }
    toast.success("Pengguna berhasil dihapus");
    setDeleteTarget(null);
    load();
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <p className="text-base font-bold text-ink">Akses ditolak</p>
        <p className="mt-2 text-sm text-muted">
          Halaman Pengguna hanya untuk Super Admin.
        </p>
        <div className="mt-5">
          <Button type="button" variant="secondary" onClick={() => (window.location.href = "/")}>
            Kembali ke Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Manajemen Pengguna"
        subtitle="Akun, peran, dan penempatan bidang"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 sm:w-auto sm:px-3.5 sm:text-sm"
          >
            <span className="text-lg leading-none">+</span>
            Tambah Pengguna
          </button>
        }
      />
      {showForm && (
        <Card className="mb-5 !p-5 sm:!p-7">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-ink">Tambah Pengguna</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Admin Bidang wajib diisi bidangnya
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={closeCreate}>
              Tutup
            </Button>
          </div>
          <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Nama lengkap"
              required
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
            />
            <Input
              label="Username"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <Input
              label="Email dinas"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Kata sandi awal"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              hint="Minimal 8 karakter"
            />
            <Select
              label="Peran"
              required
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
            >
              <option value="">Pilih peran</option>
              {assignableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Select
              label="Bidang"
              value={form.bidangId}
              onChange={(e) => setForm({ ...form, bidangId: e.target.value })}
            >
              <option value="">— Tidak diisi —</option>
              {bidang.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.namaBidang}
                </option>
              ))}
            </Select>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" loading={saving}>
                Simpan Pengguna
              </Button>
              <Button type="button" variant="secondary" onClick={closeCreate}>
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="cards-mobile-only space-y-3">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Belum ada pengguna</p>
        ) : (
          rows.map((r) => (
            <MobileCard
              key={r.id}
              title={r.nama}
              subtitle={`@${r.username}`}
              meta={
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    r.status
                      ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      : "bg-slate-50 text-slate-400"
                  }`}
                >
                  {r.status ? "Aktif" : "Nonaktif"}
                </span>
              }
              actions={
                <>
                  {canRevokeSessions(r) && (
                    <button
                      type="button"
                      disabled={revokingId === r.id}
                      onClick={() => void revokeSessions(r)}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
                    >
                      {revokingId === r.id ? "…" : "Cabut sesi"}
                    </button>
                  )}
                  {r.role.name !== "Super Admin" && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        disabled={user?.id === r.id}
                        onClick={() => setDeleteTarget(r)}
                        className="rounded-lg bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-40"
                      >
                        Hapus
                      </button>
                    </>
                  )}
                </>
              }
            >
              <FieldRow label="Peran" value={r.role.name} />
              <FieldRow label="Bidang" value={r.bidang?.namaBidang ?? "—"} />
              <FieldRow label="Email" value={r.email} />
            </MobileCard>
          ))
        )}
      </div>
      <div className="table-desktop-only">
        <Table minWidth="720px">
          <thead>
            <tr>
              <th className="px-4 py-3.5">Nama</th>
              <th className="px-4 py-3.5">Username</th>
              <th className="px-4 py-3.5">Peran</th>
              <th className="px-4 py-3.5">Bidang</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                  Belum ada pengguna
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-200">
                    {r.nama}
                  </td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{r.username}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {r.role.name}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                    {r.bidang?.namaBidang ?? "—"}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.status
                          ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          : "bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500"
                      }`}
                    >
                      {r.status ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      {canRevokeSessions(r) && (
                        <button
                          type="button"
                          disabled={revokingId === r.id}
                          onClick={() => void revokeSessions(r)}
                          className="rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-muted transition hover:border-brand hover:text-brand disabled:opacity-40"
                          title="Cabut semua sesi login"
                        >
                          {revokingId === r.id ? "…" : "Sesi"}
                        </button>
                      )}
                      {r.role.name === "Super Admin" ? (
                        !canRevokeSessions(r) ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : null
                      ) : (
                        <>
                          <IconBtn label="Edit Pengguna" onClick={() => openEdit(r)}>
                            <IconEdit />
                          </IconBtn>
                          <IconBtn
                            label="Hapus Pengguna"
                            tone="danger"
                            disabled={user?.id === r.id}
                            onClick={() => setDeleteTarget(r)}
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

      <Modal
        open={editOpen}
        title="Edit Pengguna"
        subtitle="Perbarui data akun, peran, dan status"
        onClose={closeEdit}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeEdit}>
              Batal
            </Button>
            <Button type="submit" form="edit-user-form" loading={saving}>
              Simpan Perubahan
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={onUpdate} className="space-y-3">
          <Input
            label="Nama lengkap"
            required
            value={editForm.nama}
            onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
          />
          <Input
            label="Username"
            required
            value={editForm.username}
            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
          />
          <Input
            label="Email dinas"
            type="email"
            required
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Input
            label="Kata sandi baru"
            type="password"
            minLength={8}
            value={editForm.password}
            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            hint="Kosongkan jika tidak ingin mengubah password"
          />
          <Select
            label="Peran"
            required
            value={editForm.roleId}
            onChange={(e) => setEditForm({ ...editForm, roleId: e.target.value })}
          >
            <option value="">Pilih peran</option>
            {assignableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Select
            label="Bidang"
            value={editForm.bidangId}
            onChange={(e) => setEditForm({ ...editForm, bidangId: e.target.value })}
          >
            <option value="">— Tidak diisi —</option>
            {bidang.map((b) => (
              <option key={b.id} value={b.id}>
                {b.namaBidang}
              </option>
            ))}
          </Select>
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
        title="Hapus Pengguna?"
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
            <p className="text-slate-600 dark:text-slate-300">Anda akan menghapus akun:</p>
            <div className="rounded-xl border border-line bg-canvas px-4 py-3">
              <p className="font-bold text-ink">{deleteTarget.nama}</p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-300">@{deleteTarget.username}</p>
              <p className="mt-1 text-xs text-muted">{deleteTarget.role.name}</p>
            </div>
            <p className="text-xs text-muted">
              Jika user masih terikat data surat, hapus akan ditolak — nonaktifkan saja.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
