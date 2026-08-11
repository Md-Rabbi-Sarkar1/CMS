import type { ApiErrorResponse, ApiSuccessResponse } from "@construction-ops/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type CompanyRole = "ADMIN" | "PROJECT_MANAGER" | "ENGINEER" | "WORKER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  companyId: string;
}

export interface AuthUserWithCompany extends AuthUser {
  company: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  contactInfo: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccessResponse(value: unknown): value is ApiSuccessResponse<unknown> {
  return isRecord(value) && value.success === true && "data" in value;
}

function isErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!isRecord(value) || value.success !== false) {
    return false;
  }

  const error = value.error;
  return isRecord(error) && typeof error.code === "string" && typeof error.message === "string";
}

function errorMessageFromBody(body: unknown): string | null {
  if (!isErrorResponse(body)) {
    return null;
  }

  return body.error.message;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};

  if (init?.body != null) {
    headers["Content-Type"] = "application/json";
  }

  if (init?.headers != null) {
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      isErrorResponse(body) ? body.error.code : "UNKNOWN_ERROR",
      errorMessageFromBody(body) ?? `Request failed with status ${String(response.status)}`,
    );
  }

  if (!isSuccessResponse(body)) {
    throw new ApiError(response.status, "INVALID_RESPONSE", "Server returned an invalid response");
  }

  return body.data as T;
}

export function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init);
}

export function apiPost<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: "POST", body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: "PATCH", body: JSON.stringify(body) });
}
