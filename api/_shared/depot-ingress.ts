import { createHash, timingSafeEqual } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { HttpError } from "./auth.js";

export const DEPOT_INGRESS_TYPES = ["annuaire", "attributs", "codes", "edt"] as const;
export type DepotIngressType = (typeof DEPOT_INGRESS_TYPES)[number];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function depotIngressType(req: VercelRequest): DepotIngressType {
  const value = first(req.query.type);
  if (!DEPOT_INGRESS_TYPES.includes(value as DepotIngressType)) {
    throw new HttpError(404, "Type de livrable inconnu");
  }
  return value as DepotIngressType;
}

export function requireDepotBearer(req: VercelRequest): void {
  const authorization = first(req.headers.authorization).trim();
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const expectedHex = process.env.LYCEEGEST_DEPOT_TOKEN_SHA256?.trim().toLowerCase() ?? "";
  if (!/^[a-f0-9]{64}$/.test(expectedHex) || !provided || provided.length > 512) {
    throw new HttpError(401, "Authentification du Dépôt Lycée refusée");
  }
  const providedDigest = createHash("sha256").update(provided, "utf8").digest();
  const expectedDigest = Buffer.from(expectedHex, "hex");
  if (providedDigest.length !== expectedDigest.length || !timingSafeEqual(providedDigest, expectedDigest)) {
    throw new HttpError(401, "Authentification du Dépôt Lycée refusée");
  }
}

export function requireDepotActorId(): string {
  const value = process.env.LYCEEGEST_DEPOT_ACTOR_ID?.trim() ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(503, "Le compte technique du Dépôt Lycée n'est pas configuré");
  }
  return value;
}
