// === Base URL helper ===

export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}${path}`;
}

// === Token storage (client-side) ===

const TOKEN_KEY = "ceremony_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

// === Auth helpers for fetch calls ===

export function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  if (!token) return {};
  return { "X-Ceremony-Token": token };
}

export function authQueryParam(): string {
  const token = getStoredToken();
  if (!token) return "";
  return `token=${encodeURIComponent(token)}`;
}

// === Authenticated fetch wrapper ===

export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(path);
  const headers = {
    ...authHeaders(),
    ...(init?.headers ?? {}),
  };
  return fetch(url, { ...init, headers });
}
