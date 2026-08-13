import type { ApiErrorResponse, ApiSuccessResponse } from "@construction-ops/shared";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: { field: string; message: string }[] | undefined;

  constructor(status: number, code: string, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const base = API_URL.endsWith("/api/v1") ? API_URL : `${API_URL}/api/v1`;
  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

interface RequestOptions {
  method?: string | undefined;
  body?: unknown;
  params?: Record<string, string | number | undefined> | undefined;
  signal?: AbortSignal | undefined;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const init: RequestInit = {
    method,
    headers,
    credentials: "include",
    cache: "no-store",
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  if (signal !== undefined) {
    init.signal = signal;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), init);
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Unable to reach the server. Please check your connection.");
  }

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as ApiSuccessResponse<T> | ApiErrorResponse) : null;

  if (!response.ok) {
    if (parsed && !parsed.success) {
      throw new ApiError(response.status, parsed.error.code, parsed.error.message, parsed.error.details);
    }
    if (response.status === 401) {
      throw new ApiError(401, "UNAUTHORIZED", "Your session has expired. Please log in again.");
    }
    throw new ApiError(response.status, "ERROR", `Request failed (${String(response.status)})`);
  }

  if (!parsed?.success) {
    throw new ApiError(response.status, "ERROR", "Unexpected response from server.");
  }

  return parsed.data;
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) =>
    request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
