import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Alert, Button, Input } from "../components/ui";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPass, setShowPass] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const err = await login(username, password);
    setSubmitting(false);
    if (err) setError(err);
    else navigate("/");
  }

  return (
    <div className="grid min-h-screen min-h-dvh bg-surface lg:grid-cols-2">
      {/* Form kiri */}
      <section className="flex flex-col items-center justify-center px-8 py-12 sm:px-12 lg:px-16 xl:px-20">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <div className="flex items-center gap-2.5">
              <img
                src="/dispen-logo.png"
                alt="Pemerintah Kota Tasikmalaya"
                className="h-14 w-auto object-contain"
              />
              <div>
                <p className="text-sm font-bold text-ink">Dinas Pendidikan</p>
                <p className="text-[11px] text-muted">Arsip Surat</p>
              </div>
            </div>
          </div>

          <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-ink sm:text-[2.15rem]">
            Selamat Datang{" "}
            <span className="inline-block" aria-hidden>
              👋
            </span>
          </h1>
          <p className="mt-3 text-[15px] leading-[1.7] text-muted sm:text-base">
            Halo, Selamat datang di website
            <br />
            Sistem Pengarsipan Surat Dinas Pendidikan!
          </p>

          <form onSubmit={onSubmit} className="mt-9 space-y-5">
            {error && <Alert type="error">{error}</Alert>}

            <Input
              label="Email"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              placeholder="Masukkan email anda disini..."
              inputMode="email"
              className="h-12 rounded-xl border-line bg-canvas px-4 text-[15px] shadow-none placeholder:text-muted focus:bg-surface"
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Masukkan password anda disini..."
                className="h-12 rounded-xl border-line bg-canvas px-4 pr-16 text-[15px] shadow-none placeholder:text-muted focus:bg-surface"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3.5 top-[42px] min-h-0 text-sm font-medium text-muted hover:text-brand"
              >
                {showPass ? "Sembunyi" : "Lihat"}
              </button>
            </div>

            <Button
              type="submit"
              loading={submitting}
              className="mt-1 h-12 w-full min-h-0 rounded-xl py-3 text-[15px] font-semibold shadow-none"
            >
              Sign in
            </Button>
          </form>

          {/* Footer di bawah form (bukan ujung viewport) */}
          <p className="mt-12 text-center text-[13px] font-medium tracking-[0.04em] text-muted">
            © {new Date().getFullYear()} ALL RIGHTS RESERVED
          </p>
        </div>
      </section>

      {/* Panel seni kanan */}
      <section className="relative hidden p-6 lg:block xl:p-8">
        <div className="login-art h-full min-h-[calc(100dvh-3rem)] w-full overflow-hidden rounded-[1.5rem] shadow-[0_20px_50px_rgba(15,23,42,0.12)] xl:min-h-[calc(100dvh-4rem)]">
          <div className="login-art-noise absolute inset-0" />
        </div>
      </section>
    </div>
  );
}
