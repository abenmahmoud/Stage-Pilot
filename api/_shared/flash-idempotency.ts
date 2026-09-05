// Clé d'idempotence d'un envoi de proposition flash.
//
// Même motif que `idempotencyKey`/`sha256` dans api/_shared/support.ts : le
// client fournit un identifiant d'envoi dans l'en-tête `Idempotency-Key`,
// jamais dans le corps de la requête (le corps n'est pas fiable pour rejouer
// un envoi identique). Seul le hash est stocké en base
// (flash_infos.idempotency_key_hash), jamais la valeur brute.

import { createHash } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { HttpError } from "./auth.js";

export function flashIdempotencyKey(req: VercelRequest): string {
  const header = req.headers["idempotency-key"];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || value.length < 16 || value.length > 200) {
    throw new HttpError(400, "Clé d'envoi absente ou invalide");
  }
  return value;
}

export function flashIdempotencyHash(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
