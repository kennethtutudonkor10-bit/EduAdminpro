/**
 * Central client-side auth + fetch helper.
 *
 * Holds the session token (issued by POST /api/auth/login), attaches it as a
 * Bearer header to every API call, and notifies a handler when the server
 * reports the session is no longer valid (401) so the app can return to login.
 */

const TOKEN_KEY = "edu_admin_token";

let unauthorizedHandler: (() => void) | null = null;

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}
export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

/** Registers the callback used when any API call returns 401 (expired/invalid session). */
export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn;
}

/** Auth headers to merge into a request (empty when logged out). */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

/** fetch() wrapper that carries the session token and routes 401s to the handler. */
export async function apiFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const headers = { ...(opts.headers as Record<string, string> | undefined), ...authHeaders() };
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) {
    clearToken();
    unauthorizedHandler?.();
  }
  return res;
}

export interface AuthUser {
  id?: number;
  username: string;
  role: "admin" | "teacher";
  fullName?: string;
  mustChangePassword?: boolean;
  service?: boolean;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Login failed.");
  }
  const { token, user } = await res.json();
  setToken(token);
  return user;
}

export async function fetchMe(): Promise<AuthUser | null> {
  if (!getToken()) return null;
  const res = await apiFetch("/api/auth/me");
  if (!res.ok) return null;
  const { user } = await res.json();
  return user;
}

export async function logout(): Promise<void> {
  try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
  clearToken();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await apiFetch("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Could not change password.");
  }
}
