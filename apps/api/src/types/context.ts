import type { PermissionName } from "@arsip/shared";

export type AuthUser = {
  id: number;
  nama: string;
  username: string;
  email: string;
  roleId: number;
  roleName: string;
  bidangId: number | null;
  bidangNama: string | null;
  permissions: PermissionName[];
};

export type AppVariables = {
  user: AuthUser | null;
  requestId: string;
  csrfToken: string;
};

declare module "hono" {
  interface ContextVariableMap extends AppVariables {}
}
