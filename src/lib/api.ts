import { supabase } from "./supabase-browser";

const API_BASE = "/api";

/**
 * Wrapper fetch qui injecte automatiquement le token Supabase dans le header
 * Authorization, et qui jette une erreur sur les réponses non-OK.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // pas un JSON, on garde le message par défaut
    }
    throw new Error(message);
  }

  // Certaines routes ne renvoient pas de JSON (204 No Content par exemple)
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {} as T;
  }
  return res.json() as Promise<T>;
}
