import type { PermissionName } from "./permissions";

export type AuthUserPublic = {
  id: number;
  nama: string;
  username: string;
  email: string;
  roleName: string;
  bidangId: number | null;
  bidangNama: string | null;
  permissions: PermissionName[];
};

export type ApiSuccess<T> = {
  success: true;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  success: false;
  message: string;
  errors?: unknown;
};

export type ApiResult<T> = ApiSuccess<T> | ApiError;

export type PaginationMeta = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};
