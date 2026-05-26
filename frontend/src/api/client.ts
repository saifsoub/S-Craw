import { getAccessToken } from '../store/authStore';
import { supabase } from '../lib/supabase';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    // Always use the live Supabase session token — auto-refreshed by the SDK
    const token = getAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (response.status === 401) {
      // Supabase SDK refreshes tokens automatically; force a refresh then retry once
      const { error } = await supabase.auth.refreshSession();
      if (!error) {
        const newToken = getAccessToken();
        if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
        const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
        if (retry.ok) return retry.json() as Promise<T>;
      }
      throw new ApiError('Session expired. Please sign in again.', 401);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new ApiError(body.error ?? `HTTP ${response.status}`, response.status);
    }

    return response.json() as Promise<T>;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
