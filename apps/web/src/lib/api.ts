import type { User } from "../types";

const TOKEN_KEY = "taewoong-auth-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (!(init.body instanceof FormData) && init.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  return api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export function downloadUrl(path: string) {
  const token = getToken();
  return token ? `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : path;
}
