import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

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

function hrefFor(n: Notif) {
  if (n.entity === "surat_masuk") return "/surat-masuk";
  if (n.entity === "surat_keluar") return "/surat-keluar";
  return "/notifications";
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.floor(s / 60)} mnt`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam`;
  return `${Math.floor(s / 86400)} hr`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const refreshCount = useCallback(async () => {
    const res = await api.get<{ count: number }>("/api/notifications/unread-count");
    if (res.success && res.data) setCount(res.data.count);
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    const res = await api.get<Notif[]>("/api/notifications?page=1&perPage=10");
    if (res.success && res.data) setItems(res.data);
    setLoading(false);
  }, []);

  const placePanel = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      setPanelStyle({
        position: "fixed",
        left: 12,
        right: 12,
        top: Math.max(12, r.bottom + 8),
        width: "auto",
        maxWidth: "100%",
      });
      return;
    }
    const width = Math.min(352, window.innerWidth - 24);
    let left = r.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    setPanelStyle({
      position: "fixed",
      left,
      top: r.bottom + 8,
      width,
      right: "auto",
    });
  }, []);

  useEffect(() => {
    void refreshCount();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshCount();
    }, 45_000);
    return () => window.clearInterval(t);
  }, [refreshCount]);

  useEffect(() => {
    if (open) void loadList();
  }, [open, loadList]);

  useLayoutEffect(() => {
    if (!open) return;
    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [open, placePanel]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(n: Notif) {
    if (!n.readAt) {
      await api.post(`/api/notifications/${n.id}/read`);
      setCount((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
    }
    setOpen(false);
    navigate(hrefFor(n));
  }

  async function markAll() {
    await api.post("/api/notifications/read-all");
    setCount(0);
    setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
  }

  const panel =
    open &&
    createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-slate-900/20 sm:bg-transparent"
          aria-label="Tutup notifikasi"
          onClick={() => setOpen(false)}
        />
        <div
          ref={panelRef}
          style={panelStyle}
          className="z-[70] max-h-[min(70dvh,28rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
          role="dialog"
          aria-label="Daftar notifikasi"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-sm font-bold text-ink">Notifikasi</p>
            {count > 0 && (
              <button
                type="button"
                onClick={() => void markAll()}
                className="shrink-0 text-[11px] font-semibold text-brand hover:underline sm:text-xs"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-[min(50dvh,20rem)] overflow-y-auto overscroll-contain">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Memuat…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Belum ada notifikasi</p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void markRead(n)}
                      className={`flex w-full min-w-0 flex-col gap-0.5 border-b border-line px-3 py-3 text-left transition hover:bg-canvas sm:px-4 ${
                        !n.readAt ? "bg-brand-soft/40" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-ink">
                          {n.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <span className="break-words text-xs leading-snug text-muted whitespace-normal">
                        {n.body}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-line px-4 py-2.5 text-center">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-brand hover:underline"
            >
              Lihat semua
            </Link>
          </div>
        </div>
      </>,
      document.body,
    );

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink sm:h-11 sm:w-11"
        aria-label="Notifikasi"
        title="Notifikasi"
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 19a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        {count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white sm:right-1 sm:top-1">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}
