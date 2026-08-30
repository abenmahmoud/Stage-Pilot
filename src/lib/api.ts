import { supabase } from "./supabase-browser";
import { readJsonApiResponse } from "../../shared/json-api-response";
import {
  isAllowedExternalApiFileUrl,
  readApiPdfResponse,
} from "../../shared/api-file-response";

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
    return readJsonApiResponse<T>(res);
  }

  // Certaines routes ne renvoient pas de JSON (204 No Content par exemple)
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {} as T;
  }
  return readJsonApiResponse<T>(res);
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
    popup.document.body.textContent = "Chargement du document...";
  }

  if (/^https?:\/\//i.test(path)) {
    const env = import.meta.env as Record<string, string | undefined>;
    const storageOrigin = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
    if (!isAllowedExternalApiFileUrl(path, window.location.origin, storageOrigin)) {
      if (popup) popup.close();
      throw new Error("L’adresse de ce document n’est pas autorisée.");
    }
    if (popup) {
      popup.opener = null;
      popup.location.href = path;
    } else {
      window.open(path, "_blank", "noopener,noreferrer");
    }
    return;
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl(path), { headers });
  if (!res.ok) {
    try {
      await readJsonApiResponse<Record<string, unknown>>(res);
    } catch (error) {
      if (popup) popup.close();
      throw error;
    }
    if (popup) popup.close();
    throw new Error("Le document ne peut pas être chargé pour le moment.");
  }

  let blob: Blob;
  try {
    blob = await readApiPdfResponse(res);
  } catch (error) {
    if (popup) popup.close();
    throw error;
  }
  const url = URL.createObjectURL(blob);
  if (popup) {
    popup.opener = null;
    popup.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
