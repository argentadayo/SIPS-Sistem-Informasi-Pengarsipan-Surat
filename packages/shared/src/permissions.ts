export const PERMISSIONS = {
  SURAT_MASUK_VIEW: "surat-masuk.view",
  SURAT_MASUK_CREATE: "surat-masuk.create",
  SURAT_MASUK_UPDATE: "surat-masuk.update",
  SURAT_MASUK_DELETE: "surat-masuk.delete",
  SURAT_MASUK_EXPORT: "surat-masuk.export",
  SURAT_KELUAR_VIEW: "surat-keluar.view",
  SURAT_KELUAR_CREATE: "surat-keluar.create",
  SURAT_KELUAR_UPDATE: "surat-keluar.update",
  SURAT_KELUAR_DELETE: "surat-keluar.delete",
  SURAT_KELUAR_EXPORT: "surat-keluar.export",
  MASTER_MANAGE: "master.manage",
  USER_MANAGE: "user.manage",
  DASHBOARD_VIEW: "dashboard.view",
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLES = {
  SUPER_ADMIN: "Super Admin",
  ADMIN_BIDANG: "Admin Bidang",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
