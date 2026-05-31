import type { ApiResponse } from '@zenthorax/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

async function getAuthHeaders(withContentType = true): Promise<HeadersInit> {
  const { supabase } = await import('./supabase');
  const { data } = await supabase.auth.getSession();
  const headers: HeadersInit = {};
  if (withContentType) headers['Content-Type'] = 'application/json';
  if (data.session?.access_token) {
    headers['Authorization'] = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

export async function apiGet<T>(
  path: string,
  options?: { anonymous?: boolean },
): Promise<ApiResponse<T>> {
  const headers = options?.anonymous ? {} : await getAuthHeaders(false);
  const res = await fetch(`${API_BASE}${path}`, { headers, credentials: 'include' });
  return res.json();
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: { anonymous?: boolean },
): Promise<ApiResponse<T>> {
  const headers = options?.anonymous ? { 'Content-Type': 'application/json' } : await getAuthHeaders(true);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers, credentials: 'include',
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

export async function apiPatch<T>(
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const headers = await getAuthHeaders(true);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH', headers, credentials: 'include',
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

export async function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
  const headers = await getAuthHeaders(false);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE', headers, credentials: 'include',
  });
  return res.json();
}
