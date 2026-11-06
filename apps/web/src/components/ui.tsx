import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export function Card({
  children,
  className = "",
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.25)] ${
        padding ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "danger" | "ghost" | "accent";
    loading?: boolean;
    size?: "sm" | "md";
  }
>(function Button(
  { children, variant = "primary", loading, className = "", size = "md", ...props },
  ref,
) {
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs rounded-lg",
    md: "px-3.5 py-2 text-sm rounded-xl",
  };
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
  const styles = {
    primary:
      "bg-brand text-on-brand hover:bg-brand-hover shadow-sm shadow-brand/25",
    secondary:
      "border border-line bg-surface text-ink hover:bg-canvas hover:border-muted/40",
    danger: "bg-danger text-on-brand hover:bg-danger-hover",
    ghost: "text-muted hover:bg-brand-soft hover:text-brand-dark",
    accent: "bg-accent text-on-brand hover:bg-accent-hover",
  };
  const { type = "button", disabled, ...rest } = props;
  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${sizes[size]} ${styles[variant]} ${className}`}
      disabled={loading || disabled}
      {...rest}
    >
      {loading && <span className="spinner" />}
      {children}
    </button>
  );
});

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50 dark:border-line dark:bg-surface dark:text-ink dark:placeholder:text-muted dark:focus:border-brand-mid dark:focus:ring-brand-soft dark:disabled:bg-canvas";

function FieldLabel({ label, required }: { label?: string; required?: boolean }) {
  if (!label) return null;
  return (
    <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
      {label}
      {required ? <span className="text-red-500">*</span> : null}
    </span>
  );
}

export function Input({
  label,
  error,
  hint,
  className = "",
  required,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <FieldLabel label={label} required={required} />
      <input className={`${fieldClass} ${className}`} required={required} {...props} />
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export function Select({
  label,
  error,
  children,
  className = "",
  required,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <FieldLabel label={label} required={required} />
      <select className={`${fieldClass} ${className}`} required={required} {...props}>
        {children}
      </select>
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export type SearchableSelectOption = { value: string; label: string };

/** Dropdown custom: selalu buka ke bawah + bisa search */
export function SearchableSelect({
  label,
  value,
  options,
  placeholder = "Pilih opsi",
  searchPlaceholder = "Cari…",
  emptyLabel,
  error,
  required,
  disabled,
  onChange,
}: {
  label?: string;
  value: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  /** Jika diisi, tampilkan opsi kosong di atas list */
  emptyLabel?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQ("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <FieldLabel label={label} required={required} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`${fieldClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={selected ? "truncate text-slate-700 dark:text-ink" : "truncate text-slate-400 dark:text-muted"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* hidden input agar validasi form HTML required tetap jalan */}
      {required && (
        <input
          tabIndex={-1}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value={value}
          required
          onChange={() => {}}
          aria-hidden
        />
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg shadow-slate-900/10 dark:shadow-black/40">
          <div className="border-b border-line p-2">
            <input
              ref={searchRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-brand-mid focus:ring-2 focus:ring-brand-soft"
            />
          </div>
          <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
            {emptyLabel !== undefined && (
              <li>
                <button
                  type="button"
                  className={`flex w-full px-3.5 py-2 text-left text-sm transition hover:bg-canvas ${
                    !value ? "bg-brand-soft font-semibold text-brand-dark" : "text-ink"
                  }`}
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                    setQ("");
                  }}
                >
                  {emptyLabel}
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3.5 py-3 text-sm text-muted">Tidak ada hasil</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === o.value}
                    className={`flex w-full px-3.5 py-2 text-left text-sm transition hover:bg-canvas ${
                      value === o.value
                        ? "bg-brand-soft font-semibold text-brand-dark"
                        : "text-ink"
                    }`}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setQ("");
                    }}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </div>
  );
}

/** Dropdown async: search ke server (debounce), cocok untuk master data besar */
export function AsyncSearchableSelect({
  label,
  value,
  selectedLabel,
  placeholder = "Pilih opsi",
  searchPlaceholder = "Ketik untuk mencari…",
  emptyLabel,
  minChars = 0,
  error,
  required,
  disabled,
  onChange,
  onSearch,
}: {
  label?: string;
  value: string;
  /** Label opsi terpilih (wajib diisi parent agar label tidak hilang) */
  selectedLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Minimal karakter sebelum fetch (0 = fetch saat buka) */
  minChars?: number;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string, option: SearchableSelectOption | null) => void;
  onSearch: (q: string) => Promise<SearchableSelectOption[]>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<SearchableSelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQ("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < minChars) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const t = window.setTimeout(() => {
      void onSearch(term)
        .then((rows) => {
          if (id !== reqId.current) return;
          setOptions(rows);
        })
        .catch(() => {
          if (id !== reqId.current) return;
          setOptions([]);
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false);
        });
    }, 300);
    return () => window.clearTimeout(t);
  }, [open, q, minChars, onSearch]);

  const display =
    selectedLabel ||
    options.find((o) => o.value === value)?.label ||
    (value ? `#${value}` : "");

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <FieldLabel label={label} required={required} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`${fieldClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={value ? "truncate text-slate-700 dark:text-ink" : "truncate text-slate-400 dark:text-muted"}>
          {value ? display : placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {required && (
        <input
          tabIndex={-1}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value={value}
          required
          onChange={() => {}}
          aria-hidden
        />
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg shadow-slate-900/10 dark:shadow-black/40">
          <div className="border-b border-line p-2">
            <input
              ref={searchRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-brand-mid focus:ring-2 focus:ring-brand-soft"
            />
          </div>
          <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
            {emptyLabel !== undefined && (
              <li>
                <button
                  type="button"
                  className={`flex w-full px-3.5 py-2 text-left text-sm transition hover:bg-canvas ${
                    !value ? "bg-brand-soft font-semibold text-brand-dark" : "text-ink"
                  }`}
                  onClick={() => {
                    onChange("", null);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  {emptyLabel}
                </button>
              </li>
            )}
            {loading ? (
              <li className="px-3.5 py-3 text-sm text-muted">Mencari…</li>
            ) : q.trim().length < minChars ? (
              <li className="px-3.5 py-3 text-sm text-muted">
                Ketik minimal {minChars} karakter
              </li>
            ) : options.length === 0 ? (
              <li className="px-3.5 py-3 text-sm text-muted">Tidak ada hasil</li>
            ) : (
              options.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === o.value}
                    className={`flex w-full px-3.5 py-2 text-left text-sm transition hover:bg-canvas ${
                      value === o.value
                        ? "bg-brand-soft font-semibold text-brand-dark"
                        : "text-ink"
                    }`}
                    onClick={() => {
                      onChange(o.value, o);
                      setOpen(false);
                      setQ("");
                    }}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </div>
  );
}

export function Textarea({
  label,
  error,
  className = "",
  required,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <FieldLabel label={label} required={required} />
      <textarea className={`${fieldClass} ${className}`} rows={3} required={required} {...props} />
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

/** Dropzone upload — style Figma (dashed + tombol oranye) */
export function FileDropzone({
  label,
  required,
  file,
  onFile,
  accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx",
  hint = "Please upload PDF, JPG, PNG, DOCX files · maks. 5 MB",
  disabled,
}: {
  label?: string;
  required?: boolean;
  file: File | null;
  onFile: (file: File | null) => void;
  accept?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function pick(f?: File | null) {
    if (disabled) return;
    onFile(f ?? null);
  }

  return (
    <div className="space-y-1.5">
      <FieldLabel label={label} required={required} />
      <div
        className={`flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragOver
            ? "border-blue-400 bg-blue-50/50"
            : "border-slate-200 bg-slate-50/50 dark:border-line dark:bg-canvas/40"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) pick(f);
        }}
      >
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M7 3h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        {file ? (
          <p className="mb-1 max-w-full truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
            {file.name}
          </p>
        ) : (
          <p className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Drag and Drop Your File Here!
          </p>
        )}
        <p className="mb-4 text-[11px] leading-relaxed text-slate-400">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 16V4M12 4l-4 4M12 4l4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Upload a File
        </button>
        {file && (
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-slate-400 hover:text-danger"
            onClick={() => pick(null)}
          >
            Hapus file
          </button>
        )}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex min-w-0 max-w-full flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="break-words text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 break-words text-xs text-muted sm:text-sm">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

/** Popup modal overlay */
export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        aria-label="Tutup dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 flex max-h-[min(90dvh,720px)] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl ${widths[size]}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="break-words text-base font-bold leading-snug text-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 break-words text-xs leading-snug text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
            aria-label="Tutup"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Alert({
  type = "info",
  children,
}: {
  type?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const styles = {
    info: "border-brand/25 bg-brand-soft text-brand-dark",
    error: "border-danger/20 bg-danger-soft text-danger",
    success: "border-ok/20 bg-ok-soft text-ok",
  };
  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium ${styles[type]}`}
      role="alert"
    >
      {children}
    </div>
  );
}

export function Empty({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium text-muted">{message}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Table({
  children,
  className = "",
  minWidth = "640px",
}: {
  children: ReactNode;
  className?: string;
  minWidth?: string;
}) {
  return (
    <div
      className={`w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#e8edf3] bg-white dark:border-line dark:bg-surface ${className}`}
    >
      {/* Scroll horizontal HANYA di dalam wrapper tabel, tidak di body halaman */}
      <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain p-2 sm:p-3 [-webkit-overflow-scrolling:touch]">
        <table
          className="table-app w-full text-left text-sm"
          style={{ minWidth }}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

/** Tombol aksi ikon di kolom tabel — netral seperti mockup */
export function IconBtn({
  label,
  tone = "neutral",
  onClick,
  disabled,
  children,
}: {
  label: string;
  tone?: "neutral" | "brand" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const tones = {
    neutral:
      "border-[#dce3ec] text-[#64748b] hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-[#334155] dark:border-line dark:text-muted dark:hover:bg-canvas dark:hover:text-ink",
    brand:
      "border-[#dce3ec] text-[#64748b] hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-[#334155] dark:border-line dark:text-muted dark:hover:bg-canvas dark:hover:text-ink",
    danger:
      "border-[#dce3ec] text-[#64748b] hover:border-danger/30 hover:bg-danger-soft hover:text-danger dark:border-line dark:text-muted",
  };
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`icon-hit inline-flex h-[30px] w-[30px] min-h-0 items-center justify-center rounded-md border bg-white transition disabled:pointer-events-none disabled:opacity-40 dark:bg-surface ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function IconEye() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m13.5 6.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 7h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 7v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 11v5M14 11v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Kartu data untuk tampilan mobile (ganti baris tabel) */
export function MobileCard({
  title,
  subtitle,
  meta,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="box-border w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-line bg-surface p-3 shadow-[0_1px_2px_rgba(28,43,40,0.04)] sm:p-4">
      <div className="flex min-w-0 w-full max-w-full items-start justify-between gap-2">
        <div className="min-w-0 flex-1 overflow-hidden">
          <h3 className="break-words text-sm font-bold leading-snug text-ink">{title}</h3>
          {subtitle && (
            <p className="mt-1 break-words text-xs leading-snug text-muted whitespace-normal">
              {subtitle}
            </p>
          )}
        </div>
        {meta && <div className="max-w-[30%] shrink-0 sm:max-w-[40%]">{meta}</div>}
      </div>
      {children && (
        <div className="mt-3 min-w-0 w-full max-w-full space-y-2 border-t border-line/80 pt-3 text-xs text-muted">
          {children}
        </div>
      )}
      {actions && (
        <div className="mt-3 flex min-w-0 w-full max-w-full flex-wrap gap-1.5 border-t border-line/80 pt-3">
          {actions}
        </div>
      )}
    </article>
  );
}

export function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-0.5 sm:flex-row sm:gap-x-2">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink/55 sm:w-[8.5rem] sm:text-xs sm:normal-case sm:tracking-normal sm:font-medium sm:text-ink/70">
        {label}
      </span>
      <span className="min-w-0 max-w-full flex-1 break-words whitespace-normal leading-snug text-ink">
        {value || "—"}
      </span>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "ok" | "warn" | "danger";
}) {
  const tones = {
    neutral: "bg-canvas text-muted border-line",
    brand: "bg-brand-soft text-brand-dark border-brand/15",
    ok: "bg-ok-soft text-ok border-ok/15",
    warn: "bg-warn-soft text-warn border-warn/15",
    danger: "bg-danger-soft text-danger border-danger/15",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "brand" | "accent" | "ok" | "warn";
}) {
  const bar = {
    brand: "bg-brand",
    accent: "bg-accent",
    ok: "bg-ok",
    warn: "bg-warn",
  };
  const soft = {
    brand: "bg-brand-soft text-brand-dark",
    accent: "bg-accent-soft text-accent",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
  };
  return (
    <Card className="relative overflow-hidden !p-3.5 sm:!p-5">
      <div className={`absolute inset-y-0 left-0 w-1 ${bar[tone]}`} />
      <div className="pl-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted sm:text-[13px]">{label}</p>
          <span
            className={`hidden rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide sm:inline ${soft[tone]}`}
          >
            {tone === "brand" ? "Masuk" : tone === "ok" ? "Keluar" : tone === "accent" ? "Bulan" : "Info"}
          </span>
        </div>
        <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink tabular-nums sm:mt-2 sm:text-3xl">
          {value}
        </p>
        {hint && <p className="mt-1 text-[11px] text-muted sm:text-xs">{hint}</p>}
      </div>
    </Card>
  );
}

function paginationItems(page: number, totalPages: number): (number | "…")[] {
  const tp = Number.isFinite(totalPages) && totalPages > 0 ? Math.floor(totalPages) : 1;
  const p = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  if (tp <= 7) {
    return Array.from({ length: tp }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, tp, p, p - 1, p + 1]);
  if (p <= 3) {
    set.add(2);
    set.add(3);
    set.add(4);
  }
  if (p >= tp - 2) {
    set.add(tp - 1);
    set.add(tp - 2);
    set.add(tp - 3);
  }
  const sorted = [...set].filter((n) => n >= 1 && n <= tp).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) out.push("…");
    out.push(sorted[i]!);
  }
  return out;
}

export function Pagination({
  page,
  totalPages,
  total,
  perPage,
  perPageOptions = [10, 20, 30, 50],
  loading,
  onPageChange,
  onPerPageChange,
}: {
  page: number;
  totalPages: number;
  total?: number;
  perPage: number;
  perPageOptions?: number[];
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}) {
  const pages = useMemo(() => paginationItems(page, Math.max(1, totalPages)), [page, totalPages]);
  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  const btnBase =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40";
  const btnIdle =
    "border-line bg-surface text-slate-600 hover:border-slate-300 hover:bg-canvas dark:text-slate-300 dark:hover:border-slate-600";
  const btnActive = "border-brand bg-surface text-brand shadow-[0_0_0_1px_var(--color-brand)]";
  const btnNav =
    "border-line bg-canvas text-slate-400 hover:bg-surface hover:text-ink disabled:bg-canvas dark:text-slate-500";

  return (
    <div className="mt-4 w-full min-w-0 max-w-full space-y-2">
      {/* Mobile: prev | Hal x/y | next  +  per page — satu baris muat layar */}
      <div className="flex w-full min-w-0 items-center gap-2 sm:hidden">
        <button
          type="button"
          aria-label="Halaman sebelumnya"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className={`${btnBase} ${btnNav} shrink-0 px-2`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m15 6-6 6 6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-xs text-muted">
          Hal <strong className="text-ink">{page}</strong>
          <span className="mx-0.5">/</span>
          {Math.max(1, totalPages)}
          {total != null && (
            <>
              <span className="mx-1 text-line">·</span>
              <strong className="text-ink">{total}</strong> data
            </>
          )}
        </p>
        <button
          type="button"
          aria-label="Halaman berikutnya"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className={`${btnBase} ${btnNav} shrink-0 px-2`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m9 6 6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <label className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
          <select
            value={perPage}
            disabled={loading}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="h-8 w-12 rounded-lg border border-line bg-surface px-1 text-sm font-medium text-ink outline-none focus:border-brand-mid disabled:opacity-50"
            aria-label="Data per halaman"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Desktop: full controls */}
      <div className="hidden w-full min-w-0 items-center justify-between gap-3 sm:flex">
        <p className="text-xs text-muted">
          {total != null ? (
            <>
              <strong className="text-ink">{total}</strong> data
            </>
          ) : (
            <span className="invisible">—</span>
          )}
        </p>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            aria-label="Halaman sebelumnya"
            disabled={!canPrev}
            onClick={() => onPageChange(page - 1)}
            className={`${btnBase} ${btnNav} px-2`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="m15 6-6 6 6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {pages.map((p, i) =>
            p === "…" ? (
              <span
                key={`e-${i}`}
                className="inline-flex h-8 min-w-8 items-center justify-center text-sm text-muted"
              >
                …
              </span>
            ) : (
              <button
                type="button"
                key={p}
                disabled={loading}
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPageChange(p)}
                className={`${btnBase} ${p === page ? btnActive : btnIdle} min-w-8 px-2.5`}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="Halaman berikutnya"
            disabled={!canNext}
            onClick={() => onPageChange(page + 1)}
            className={`${btnBase} ${btnNav} px-2`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="m9 6 6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-muted">
            <select
              value={perPage}
              disabled={loading}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="h-8 min-w-[4.5rem] rounded-lg border border-line bg-surface px-2.5 text-sm font-medium text-ink outline-none focus:border-brand-mid disabled:opacity-50"
              aria-label="Data per halaman"
            >
              {perPageOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="whitespace-nowrap">/Page</span>
          </label>
        </div>
      </div>
    </div>
  );
}
