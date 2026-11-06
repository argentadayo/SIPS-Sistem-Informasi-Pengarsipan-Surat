import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import {
  Button,
  Card,
  FieldRow,
  MobileCard,
  PageHeader,
  Pagination,
  Table,
} from "../components/ui";

type Notif = {
  id: number;
  type: string;
  title: string;
  body: string;
  entity: string;
  entityId: number;
  readAt: string | null;
  createdAt: string;
};

type TgStatus = {
  enabled: boolean;
  linked: boolean;
  botUsername: string;
  pendingCode: string | null;
  pendingExpiresAt: string | null;
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.roleName === "Super Admin";
  const [rows, setRows] = useState<Notif[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [perPage, setPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [tg, setTg] = useState<TgStatus | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkInstruction, setLinkInstruction] = useState<string | null>(null);

  const load = useCallback(
    async (page = 1, size = perPage) => {
      setLoading(true);
      const res = await api.get<Notif[]>(
        `/api/notifications?page=${page}&perPage=${size}`,
      );
      if (res.success && res.data) {
        setRows(res.data);
        setMeta({
          page: Number(res.meta?.page ?? page),
          totalPages: Number(res.meta?.totalPages ?? 1),
          total: Number(res.meta?.total ?? 0),
        });
      }
      setLoading(false);
    },
    [perPage],
  );

  const loadTg = useCallback(async () => {
    const res = await api.get<TgStatus>("/api/notifications/telegram/status");
    if (res.success && res.data) setTg(res.data);
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  useEffect(() => {
    if (!isSuperAdmin) void loadTg();
  }, [loadTg, isSuperAdmin]);

  async function openNotif(n: Notif) {
    if (!n.readAt) await api.post(`/api/notifications/${n.id}/read`);
    if (n.entity === "surat_masuk") navigate("/surat-masuk");
    else if (n.entity === "surat_keluar") navigate("/surat-keluar");
    else void load(meta.page);
  }

  async function markAll() {
    const res = await api.post("/api/notifications/read-all");
    if (res.success) {
      toast.success("Semua notifikasi ditandai dibaca");
      void load(meta.page);
    } else toast.error(formatApiError(res, "Gagal menandai notifikasi"));
  }

  async function createLink() {
    setTgBusy(true);
    const res = await api.post<{
      code: string;
      instruction: string;
      botUsername: string;
    }>("/api/notifications/telegram/link");
    setTgBusy(false);
    if (!res.success || !res.data) {
      toast.error(formatApiError(res, "Gagal membuat kode tautan"));
      return;
    }
    setLinkCode(res.data.code);
    setLinkInstruction(res.data.instruction);
    toast.success("Kode tautan Telegram siap digunakan");
    void loadTg();
  }

  async function unlinkTg() {
    setTgBusy(true);
    const res = await api.post("/api/notifications/telegram/unlink");
    setTgBusy(false);
    if (!res.success) {
      toast.error(formatApiError(res, "Gagal melepas Telegram"));
      return;
    }
    setLinkCode(null);
    setLinkInstruction(null);
    toast.success("Telegram berhasil dilepas");
    void loadTg();
  }

  return (
    <div>
      <PageHeader
        title="Notifikasi"
        subtitle={
          isSuperAdmin
            ? "Pemberitahuan semua surat masuk/keluar dari seluruh bidang"
            : "Pemberitahuan surat masuk/keluar untuk bidang Anda"
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => void markAll()}>
            Tandai semua dibaca
          </Button>
        }
      />

      {!isSuperAdmin && (
        <Card className="mb-4">
          <h2 className="mb-1 text-base font-bold text-ink">Telegram</h2>
          <p className="mb-3 text-xs text-muted">
            Hubungkan akun Telegram agar notifikasi juga masuk ke HP (opsional).
          </p>
          {!tg ? (
            <p className="text-sm text-muted">Memuat status…</p>
          ) : !tg.enabled ? (
            <p className="text-sm text-muted">
              Bot Telegram belum dikonfigurasi di server (TELEGRAM_BOT_TOKEN).
            </p>
          ) : tg.linked ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Terhubung
              </span>
              {tg.botUsername && (
                <span className="text-sm text-muted">@{tg.botUsername}</span>
              )}
              <Button
                variant="secondary"
                size="sm"
                loading={tgBusy}
                onClick={() => void unlinkTg()}
              >
                Lepas tautan
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Button size="sm" loading={tgBusy} onClick={() => void createLink()}>
                Buat kode taut
              </Button>
              {(linkCode || tg.pendingCode) && (
                <div className="rounded-xl border border-line bg-canvas px-4 py-3 text-sm">
                  <p className="font-semibold text-ink">
                    Kode:{" "}
                    <code className="rounded bg-surface px-2 py-0.5 font-mono text-brand">
                      {linkCode || tg.pendingCode}
                    </code>
                  </p>
                  <p className="mt-2 text-muted">
                    {linkInstruction ||
                      (tg.botUsername
                        ? `Buka @${tg.botUsername} lalu kirim: /link ${linkCode || tg.pendingCode}`
                        : `Kirim ke bot: /link ${linkCode || tg.pendingCode}`)}
                  </p>
                  <p className="mt-1 text-xs text-muted">Kode berlaku 15 menit.</p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="cards-mobile-only space-y-3">
        {loading && rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Memuat…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Belum ada notifikasi</p>
        ) : (
          rows.map((n) => (
            <button
              key={n.id}
              type="button"
              className="w-full text-left"
              onClick={() => void openNotif(n)}
            >
              <MobileCard
                title={n.title}
                subtitle={n.body}
                meta={
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      n.readAt
                        ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-brand-soft text-brand-dark"
                    }`}
                  >
                    {n.readAt ? "Dibaca" : "Baru"}
                  </span>
                }
              >
                <FieldRow
                  label="Waktu"
                  value={new Date(n.createdAt).toLocaleString("id-ID")}
                />
              </MobileCard>
            </button>
          ))
        )}
      </div>

      <div className="table-desktop-only">
        <Table minWidth="640px">
          <thead>
            <tr>
              <th className="px-4 py-3.5">Judul</th>
              <th className="px-4 py-3.5">Pesan</th>
              <th className="px-4 py-3.5">Waktu</th>
              <th className="px-4 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted">
                  Memuat…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted">
                  Belum ada notifikasi
                </td>
              </tr>
            ) : (
              rows.map((n) => (
                <tr
                  key={n.id}
                  className="cursor-pointer"
                  onClick={() => void openNotif(n)}
                >
                  <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-200">
                    {n.title}
                  </td>
                  <td className="max-w-md px-4 py-4 text-sm leading-snug text-slate-600 whitespace-normal break-words dark:text-slate-300">
                    {n.body}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs text-muted">
                    {new Date(n.createdAt).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        n.readAt
                          ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          : "bg-brand-soft text-brand-dark"
                      }`}
                    >
                      {n.readAt ? "Dibaca" : "Baru"}
                    </span>
                  </td>
                </tr>
              ))
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
        onPageChange={(p) => void load(p)}
        onPerPageChange={setPerPage}
      />
    </div>
  );
}
