import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ensureCsrf, formatApiError, setCsrfToken, type UserMe } from "./api";

type AuthCtx = {
  user: UserMe | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  /** Cabut semua sesi (semua perangkat) lalu logout */
  logoutAll: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await api.get<UserMe>("/api/auth/me");
    if (res.success && res.data) {
      if (res.data.csrfToken) setCsrfToken(res.data.csrfToken);
      setUser(res.data);
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await ensureCsrf();
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    await ensureCsrf();
    const res = await api.post<{ user: UserMe; csrfToken?: string }>("/api/auth/login", {
      username,
      password,
    });
    if (!res.success) return formatApiError(res, "Username atau password salah");
    if (res.data?.csrfToken) setCsrfToken(res.data.csrfToken);
    await refresh();
    return null;
  }, [refresh]);

  const logout = useCallback(async () => {
    const res = await api.post<{ csrfToken?: string }>("/api/auth/logout");
    if (res.data?.csrfToken) setCsrfToken(res.data.csrfToken);
    else {
      setCsrfToken(null);
      await ensureCsrf();
    }
    setUser(null);
  }, []);

  const logoutAll = useCallback(async () => {
    const res = await api.post<{ csrfToken?: string; count?: number }>("/api/auth/logout-all");
    if (!res.success) {
      throw new Error(formatApiError(res, "Gagal keluar dari semua perangkat"));
    }
    if (res.data?.csrfToken) setCsrfToken(res.data.csrfToken);
    else {
      setCsrfToken(null);
      await ensureCsrf();
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, logoutAll, refresh }),
    [user, loading, login, logout, logoutAll, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
