import type { VercelResponse } from "@vercel/node";
import { HttpError } from "./auth.js";

/**
 * Wrapper qui attrape les HttpError et les convertit en réponses propres,
 * et qui logge proprement les erreurs serveur 500.
 */
export async function handleApi(
  res: VercelResponse,
  fn: () => Promise<unknown>
): Promise<void> {
  try {
    const data = await fn();
    if (res.headersSent) return;
    res.status(200).json(data ?? { ok: true });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    // eslint-disable-next-line no-console
    console.error("[api] unexpected error", err);
    res.status(500).json({
      error: "Erreur serveur",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]): void {
  res.setHeader("Allow", allowed.join(", "));
  res.status(405).json({ error: "Method not allowed" });
}
