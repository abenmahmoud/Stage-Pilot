import { supabase } from "./supabase-browser";

const API_BASE = "/api";

function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.startsWith("/api/")
    ? path.slice("/api/".length)
    : path.replace(/^\/+/, "");
  return `${API_BASE}/${cleanPath}`;
}

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

  const res = await fetch(apiUrl(path), {
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

export async function openApiFile(
  path: string,
  targetWindow?: Window | null
): Promise<void> {
  const popup =
    targetWindow === undefined
      ? window.open("about:blank", "_blank")
      : targetWindow;

  if (popup) {
    popup.document.title = "Chargement du document";
    popup.document.body.innerHTML =
      '<p style="font-family:system-ui;padding:24px">Chargement du document...</p>';
  }

  if (/^https?:\/\//i.test(path)) {
    if (popup) {
      popup.location.href = path;
    } else {
      window.open(path, "_blank");
    }
    return;
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl(path), { headers });
  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // pas un JSON, on garde le message par defaut
    }
    if (popup) popup.close();
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  if (popup) {
    popup.location.href = url;
  } else {
    window.open(url, "_blank");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
