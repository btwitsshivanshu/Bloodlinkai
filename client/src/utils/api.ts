// ============================================================
// API Helper — Centralized fetch wrapper with auth
// ============================================================

export const BASE = 'https://bloodlinkai-backend.onrender.com/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  let data: T;
  try {
    data = await res.json();
  } catch {
    throw new Error('Server returned an invalid response');
  }

  if (!res.ok) {
    throw new Error((data as any)?.error || `Request failed (${res.status})`);
  }
  return data;
}
