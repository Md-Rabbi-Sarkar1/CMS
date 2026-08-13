import { api, ApiError } from "./api-client";
import type { User } from "./types";

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await api.get<User>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function login(email: string, password: string): Promise<User> {
  return api.post<User>("/auth/login", { email, password });
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}
