import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "info";

type Notice = {
  type: ToastType;
  message: string;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  push: (type: ToastType, message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Popup notifikasi (bukan toast banner) — success/error/info + tombol OK */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setNotice(null), []);

  const push = useCallback((type: ToastType, message: string) => {
    const text = message.trim();
    if (!text) return;
    setNotice({ type, message: text });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  useEffect(() => {
    if (!notice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => okRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [notice, close]);

  const title =
    notice?.type === "success"
      ? "Berhasil"
      : notice?.type === "error"
        ? "Gagal"
        : "Informasi";

  const iconWrap =
    notice?.type === "success"
      ? "bg-ok-soft text-ok"
      : notice?.type === "error"
        ? "bg-danger-soft text-danger"
        : "bg-brand-soft text-brand-dark";

  return (
    <ToastContext.Provider value={api}>
      {children}
      {notice && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            aria-label="Tutup dialog"
            onClick={close}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="notice-title"
            aria-describedby="notice-desc"
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl"
          >
            <div className="px-5 pb-2 pt-6 text-center">
              <div
                className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${iconWrap}`}
              >
                {notice.type === "success" ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M20 6 9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : notice.type === "error" ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 8v5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 8v4m0 4h.01"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                )}
              </div>
              <h2 id="notice-title" className="text-lg font-bold text-ink">
                {title}
              </h2>
              <p
                id="notice-desc"
                className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
              >
                {notice.message}
              </p>
            </div>
            <div className="flex justify-center border-t border-line px-5 py-4">
              <button
                ref={okRef}
                type="button"
                onClick={close}
                className="inline-flex min-w-[7rem] items-center justify-center rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-on-brand shadow-sm shadow-brand/25 transition hover:bg-brand-hover active:scale-[0.98]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback aman (hindari blank page) — seharusnya selalu di dalam ToastProvider
    return {
      success: (m: string) => window.alert(m),
      error: (m: string) => window.alert(m),
      info: (m: string) => window.alert(m),
      push: (_t: ToastType, m: string) => window.alert(m),
    };
  }
  return ctx;
}
