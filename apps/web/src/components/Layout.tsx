import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { can } from "../lib/api";
import { useTheme } from "../lib/theme";
import { NotificationBell } from "./NotificationBell";

type NavItem = {
  to: string;
  label: string;
  short: string;
  perm: string;
  icon: ReactNode;
};

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: "Dashboard",
    items: [
      {
        to: "/",
        label: "Overview",
        short: "Home",
        perm: "dashboard.view",
        icon: (
          <path
            d="M12 3.5 4 9.2V20a1 1 0 0 0 1 1h5v-6h4v6h5a1 1 0 0 0 1-1V9.2L12 3.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        ),
      },
    ],
  },
  {
    title: "Arsip Surat",
    items: [
      {
        to: "/surat-masuk",
        label: "Surat Masuk",
        short: "Masuk",
        perm: "surat-masuk.view",
        icon: (
          <>
            <path d="M4 7h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Z" stroke="currentColor" strokeWidth="1.6" />
            <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </>
        ),
      },
      {
        to: "/surat-keluar",
        label: "Surat Keluar",
        short: "Keluar",
        perm: "surat-keluar.view",
        icon: (
          <>
            <path d="M7 4h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" />
            <path d="M14 4v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </>
        ),
      },
    ],
  },
  {
    title: "Master Data",
    items: [
      {
        to: "/master",
        label: "Kode Klasifikasi",
        short: "Master",
        perm: "master.manage",
        icon: (
          <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ),
      },
    ],
  },
  {
    title: "Manajemen",
    items: [
      {
        to: "/users",
        label: "Pengguna",
        short: "User",
        perm: "user.manage",
        icon: (
          <>
            <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </>
        ),
      },
    ],
  },
];

const pageMeta: Record<string, { parent: string; current: string }> = {
  "/": { parent: "Dashboard", current: "Overview" },
  "/surat-masuk": { parent: "Arsip Surat", current: "Surat Masuk" },
  "/surat-keluar": { parent: "Arsip Surat", current: "Surat Keluar" },
  "/master": { parent: "Master Data", current: "Kode Klasifikasi" },
  "/users": { parent: "Manajemen", current: "Pengguna" },
  "/notifications": { parent: "Akun", current: "Notifikasi" },
};

function initials(name?: string) {
  if (!name) return "U";
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, logoutAll } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const isSuperAdmin = user?.roleName === "Super Admin";

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((n) => can(user, n.perm)) }))
    .filter((g) => g.items.length > 0);

  const flatItems = visibleGroups.flatMap((g) => g.items);
  const bottomItems = flatItems.filter(
    (item, idx, arr) => arr.findIndex((x) => x.to === item.to) === idx,
  );

  const meta = pageMeta[location.pathname] ?? {
    parent: "Arsip Surat",
    current: "Halaman",
  };

  useEffect(() => {
    setOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1024) setOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function handleLogout() {
    setAccountMenuOpen(false);
    await logout();
    navigate("/login");
  }

  async function handleLogoutAll() {
    setAccountMenuOpen(false);
    if (
      !window.confirm(
        "Keluar dari semua perangkat? Semua sesi login (HP, laptop, dll.) akan diakhiri.",
      )
    ) {
      return;
    }
    try {
      await logoutAll();
      navigate("/login");
    } catch {
      /* Super Admin only; error tetap di halaman */
    }
  }

  const sidebar = (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-surface text-ink">
      <div className="safe-top shrink-0 px-5 py-7">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/"
            className="ml-2 flex min-w-0 items-center gap-3"
            onClick={() => setOpen(false)}
          >
            <img
              src="/dispen-logo.png"
              alt="Pemerintah Kota Tasikmalaya"
              className="h-14 w-auto shrink-0 object-contain object-left"
            />
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-extrabold text-ink">Dinas Pendidikan</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Kota Tasikmalaya
              </p>
            </div>
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <nav className="sidebar-scroll min-h-0 flex-1 space-y-7 overflow-y-auto px-4 pb-5">
        {visibleGroups.map((g) => (
          <div key={g.title}>
            <p className="mb-2.5 px-3 text-sm font-medium text-muted">{g.title}</p>
            <div className="space-y-1">
              {g.items.map((n) => (
                <NavLink
                  key={`${g.title}-${n.to}-${n.label}`}
                  to={n.to}
                  end={n.to === "/"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                     `flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                      isActive
                        ? "bg-brand-soft text-brand-dark"
                        : "text-muted hover:bg-canvas hover:text-ink"
                    }`
                  }
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
                    {n.icon}
                  </svg>
                  <span className="truncate">{n.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="app-shell relative min-h-screen min-h-dvh w-full max-w-full overflow-x-hidden bg-canvas">
      {/* Desktop: sidebar fixed full viewport height — putih sampai ujung bawah layar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-line bg-surface lg:flex">
        {sidebar}
      </aside>

      <div
        className={`fixed inset-0 z-40 lg:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Tutup menu"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        />
        <div
          className={`absolute inset-y-0 left-0 flex h-full min-h-dvh w-[min(300px,88%)] max-w-full flex-col border-r border-line bg-surface shadow-2xl transition-transform duration-200 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebar}
        </div>
      </div>

      {/* Konten utama: offset kiri = lebar sidebar di desktop */}
      <div className="flex min-h-screen min-h-dvh min-w-0 w-full max-w-full flex-col overflow-x-hidden pb-[4.25rem] lg:pb-0 lg:pl-[260px]">
        <header className="safe-top sticky top-0 z-20 w-full min-w-0 max-w-full border-b border-line bg-surface/95 backdrop-blur-md">
          <div className="flex h-14 w-full min-w-0 max-w-full items-center justify-between gap-1 overflow-visible px-3 py-2 sm:h-20 sm:gap-4 sm:px-5 sm:py-4 lg:px-7 xl:px-9">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Buka menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <p className="min-w-0 truncate text-xs font-medium text-muted sm:text-sm">
                {meta.parent}
                <span className="mx-1 text-line sm:mx-1.5">/</span>
                <span className="font-medium text-ink/80">{meta.current}</span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-0.5 sm:gap-3">
              <NotificationBell />
              <button
                type="button"
                onClick={toggle}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink sm:h-11 sm:w-11"
                aria-label={theme === "dark" ? "Mode terang" : "Mode gelap"}
                title={theme === "dark" ? "Mode terang" : "Mode gelap"}
              >
                {theme === "dark" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
                    <path
                      d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>

              <div
                className="flex items-center gap-1.5 sm:gap-3"
                title={[user?.roleName, user?.bidangNama].filter(Boolean).join(" · ")}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas text-[11px] font-bold text-ink sm:h-12 sm:w-12 sm:text-sm">
                  {initials(user?.nama)}
                </div>
                <div className="hidden min-w-0 max-w-[9rem] sm:block md:max-w-[12rem]">
                  <p className="truncate text-sm font-bold text-ink sm:text-base">
                    {user?.nama?.split(" ")[0]}
                  </p>
                  <p className="truncate text-xs text-muted sm:text-sm">
                    {user?.bidangNama || user?.roleName}
                  </p>
                </div>
              </div>

              <div className="relative flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-danger sm:h-11 sm:w-11"
                  aria-label="Keluar"
                  title="Keluar"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M9 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M15 16l4-4-4-4M19 12H10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {isSuperAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => setAccountMenuOpen((v) => !v)}
                      className="inline-flex h-9 w-7 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink sm:h-11 sm:w-8"
                      aria-label="Opsi Super Admin"
                      aria-expanded={accountMenuOpen}
                      title="Opsi Super Admin"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {accountMenuOpen && (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-[60] cursor-default bg-transparent"
                          aria-label="Tutup menu"
                          onClick={() => setAccountMenuOpen(false)}
                        />
                        <div
                          role="menu"
                          className="absolute right-0 top-[calc(100%+6px)] z-[70] w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void handleLogoutAll()}
                            className="flex w-full px-3.5 py-2.5 text-left text-sm font-semibold text-danger transition hover:bg-danger-soft/50"
                          >
                            Keluar semua perangkat
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="page-main w-full min-w-0 max-w-full flex-1 overflow-x-hidden px-3 py-4 sm:px-5 sm:py-7 lg:px-7 lg:py-8 xl:px-9">
          {children}
        </main>
      </div>

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 w-full max-w-full overflow-x-hidden border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
        aria-label="Navigasi bawah"
      >
        <div
          className={`mx-auto grid max-w-lg ${
            bottomItems.length <= 3
              ? "grid-cols-3"
              : bottomItems.length === 4
                ? "grid-cols-4"
                : "grid-cols-5"
          }`}
        >
          {bottomItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `icon-hit flex min-h-[3rem] flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[10px] font-semibold transition sm:min-h-[3.25rem] sm:text-[11px] ${
                  isActive ? "text-brand" : "text-muted"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg sm:h-8 sm:w-8 ${
                      isActive ? "bg-brand-soft" : ""
                    }`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                      {n.icon}
                    </svg>
                  </span>
                  <span className="max-w-full truncate px-0.5">{n.short}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
