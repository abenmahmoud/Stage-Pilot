import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { VercelRequest } from "@vercel/node";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const requireAgentMfa = process.env.REQUIRE_AGENT_MFA === "true";
const agentMfaRoles = new Set(["superadmin", "administration", "agent", "proviseur"]);

/**
 * Client admin avec service_role — bypass RLS.
 * À utiliser uniquement dans les API routes (jamais exposé au client).
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export type AuthUser = {
  id: string;
  email: string | null;
  emailConfirmedAt: string | null;
  role: string;
  appMetadata: Record<string, unknown>;
};

/**
 * Vérifie le token JWT envoyé en `Authorization: Bearer <token>` et renvoie
 * l'utilisateur courant. Retourne null si pas connecté ou token invalide.
 */
export async function getUserFromRequest(req: VercelRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const appMeta = (data.user.app_metadata ?? {}) as Record<string, unknown>;
  const role = typeof appMeta.role === "string" ? (appMeta.role as string) : "eleve";

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    emailConfirmedAt: data.user.email_confirmed_at ?? null,
    role,
    appMetadata: appMeta,
  };
}

export async function requireUser(req: VercelRequest): Promise<AuthUser> {
  const user = await getUserFromRequest(req);
  if (!user) {
    throw new HttpError(401, "Non authentifié");
  }
  return user;
}

export async function getAuthenticatorLevelFromRequest(
  req: VercelRequest
): Promise<"aal1" | "aal2"> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!token) return "aal1";

  const { data, error } =
    await supabaseAdmin.auth.mfa.getAuthenticatorAssuranceLevel(token);
  if (error || data.currentLevel !== "aal2") return "aal1";
  return "aal2";
}

export async function requireRole(
  req: VercelRequest,
  allowedRoles: readonly string[]
): Promise<AuthUser> {
  const user = await requireUser(req);
  if (!allowedRoles.includes(user.role)) {
    throw new HttpError(403, `Rôle insuffisant. Attendu : ${allowedRoles.join(", ")}`);
  }
  if (agentMfaRoles.has(user.role)) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";
    const { data, error } =
      await supabaseAdmin.auth.mfa.getAuthenticatorAssuranceLevel(token);
    if (error) {
      throw new HttpError(
        503,
        "La vérification renforcée est momentanément indisponible."
      );
    }
    const mustUseMfa = requireAgentMfa || data.nextLevel === "aal2";
    if (mustUseMfa && data.currentLevel !== "aal2") {
      throw new HttpError(
        403,
        "Double vérification requise. Ouvrez la page Sécurité du compte."
      );
    }
  }
  return user;
}

export async function requireAal2(req: VercelRequest): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!token) throw new HttpError(401, "Non authentifié");
  const { data, error } = await supabaseAdmin.auth.mfa.getAuthenticatorAssuranceLevel(token);
  if (error) {
    throw new HttpError(503, "La double vérification est momentanément indisponible.");
  }
  if (data.currentLevel !== "aal2") {
    throw new HttpError(403, "Double vérification obligatoire pour cette action.");
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function secretMatches(
  expected: string | undefined,
  provided: string | undefined
): boolean {
  if (!expected || !provided) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}
