import type { PermissionName } from "@arsip/shared";

const BASE = import.meta.env.VITE_API_URL || "";

export type ApiFieldError = {
  field?: string;
  label?: string;
  message?: string;
};

export type ApiResult<T> = {
  success: boolean;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
  errors?: ApiFieldError[] | unknown;
};

const UNSAFE_MSG =
  /prisma|sql|stack|exception|econnrefused|enoent|etimedout|internal server|http\s*\d|at\s+[\w.]+\s*\(|[A-Za-z]:\\|\/var\/|node_modules|select\s+.+\s+from|insert\s+into|update\s+\w+\s+set|constraint|foreign key|unique constraint|deadlock|typescript|zoderror/i;

function isSafeClientMessage(msg: string) {
  const t = msg.trim();
  if (!t || t.length > 180) return false;
  if (UNSAFE_MSG.test(t)) return false;
  if (/[{}[\]<>]/.test(t) && /error|exception|trace/i.test(t)) return false;
  return true;
}

/**
 * Pesan error untuk UI — jangan menampilkan error mentah BE.
 * Field validation: tampilkan label field saja.
 * Fallback custom FE selalu dipakai jika message BE tidak aman / kosong.
 */
export function formatApiError(res: ApiResult<unknown>, fallback = "Terjadi kesalahan") {
  if (Array.isArray(res.errors) && res.errors.length > 0) {
    const labels = (res.errors as ApiFieldError[])
      .map((e) => e.label || humanizeField(e.field))
      .filter(Boolean) as string[];
    if (labels.length) {
      const unique = [...new Set(labels)];
      return unique.length === 1
        ? `Periksa isian ${unique[0]}`
        : `Periksa isian: ${unique.join(", ")}`;
    }
  }
  // Hanya terima message BE yang sudah aman (pesan bisnis pendek)
  if (res.message && isSafeClientMessage(res.message)) {
    return res.message.trim();
  }
  return fallback;
}

function humanizeField(field?: string) {
  if (!field) return "";
  const map: Record<string, string> = {
    nama: "Nama",
    username: "Username",
    email: "Email",
    password: "Kata sandi",
    roleId: "Peran",
    bidangId: "Bidang",
    kode: "Kode",
    kategoriId: "Kategori",
    namaKelompok: "Indeks",
    namaIndeks: "Sub indeks",
    namaBidang: "Nama bidang",
    singkatan: "Singkatan",
    nomorSurat: "Nomor surat",
    perihal: "Perihal",
    file: "File",
  };
  return map[field] || field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

/** Token CSRF di memori (sinkron dengan cookie non-httpOnly di API) */
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token && token.length >= 32 ? token : null;
}

export function getCsrfToken() {
  return csrfToken;
}

function isMutatingMethod(method: string) {
  const m = method.toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

function isCsrfError(res: ApiResult<unknown>) {
  if (!res || res.success) return false;
  const msg = (res.message || "").toLowerCase();
  return msg.includes("csrf");
}

/** Ambil / refresh CSRF dari API (set cookie + token memori) */
export async function ensureCsrf(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/csrf`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return csrfToken;
    const json = (await res.json()) as ApiResult<{ csrfToken?: string }>;
    if (json.success && json.data?.csrfToken) {
      setCsrfToken(json.data.csrfToken);
      return json.data.csrfToken;
    }
  } catch {
    /* ignore */
  }
  return csrfToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<ApiResult<T>> {
  try {
    const method = (options.method || "GET").toUpperCase();
    const headers: Record<string, string> = {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers as Record<string, string> | undefined),
    };

    if (isMutatingMethod(method)) {
      if (!csrfToken) await ensureCsrf();
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    }

    const res = await fetch(`${BASE}${path}`, {
      credentials: "include",
      ...options,
      headers,
    });

    const contentType = res.headers.get("content-type") || "";
    if (
      contentType.includes("application/json") ||
      contentType.includes("application/problem")
    ) {
      try {
        const json = (await res.json()) as ApiResult<T>;
        if (!res.ok && !json.message) {
          json.message = `HTTP ${res.status}`;
          json.success = false;
        }
        if (json.success === undefined && !res.ok) json.success = false;

        // Token kedaluwarsa / mismatch → refresh sekali lalu ulang
        if (!retried && res.status === 403 && isMutatingMethod(method) && isCsrfError(json)) {
          setCsrfToken(null);
          await ensureCsrf();
          return request<T>(path, options, true);
        }

        // Ambil token baru dari body jika dikirim (login/logout/me)
        const data = json.data as { csrfToken?: string } | undefined;
        if (data && typeof data === "object" && typeof data.csrfToken === "string") {
          setCsrfToken(data.csrfToken);
        }

        return json;
      } catch {
        return { success: false, message: `HTTP ${res.status}` };
      }
    }

    if (!res.ok) {
      return { success: false, message: `HTTP ${res.status}` };
    }
    return { success: true, data: (await res.blob()) as unknown as T };
  } catch {
    return { success: false, message: "Tidak dapat terhubung ke server" };
  }
}

function authHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  if (csrfToken) h["X-CSRF-Token"] = csrfToken;
  return h;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body ?? {}),
    }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  download: async (path: string, filename: string) => {
    if (!csrfToken) await ensureCsrf();
    const res = await fetch(`${BASE}${path}`, {
      credentials: "include",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Download gagal");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  /** Buka preview cetak (HTML) di tab baru */
  openPrint: async (path: string) => {
    if (!csrfToken) await ensureCsrf();
    const res = await fetch(`${BASE}${path}`, {
      credentials: "include",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Gagal memuat preview cetak");
    const html = await res.text();
    const w = window.open("", "_blank");
    if (!w) throw new Error("Popup diblokir browser — izinkan pop-up untuk cetak");
    w.document.open();
    w.document.write(html);
    w.document.close();
  },
};

export type UserMe = {
  id: number;
  nama: string;
  username: string;
  email: string;
  roleName: string;
  bidangId: number | null;
  bidangNama: string | null;
  permissions: PermissionName[] | string[];
  csrfToken?: string;
};

export function can(user: UserMe | null, perm: string) {
  if (!user) return false;
  // Super Admin selalu punya akses penuh (aman jika list permission sesi belum lengkap)
  if (user.roleName === "Super Admin") return true;
  return Boolean(user.permissions?.includes(perm as PermissionName));
}
