import { createClient } from "@supabase/supabase-js";
import type { VercelRequest } from "@vercel/node";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

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

export async function requireRole(
  req: VercelRequest,
  allowedRoles: string[]
): Promise<AuthUser> {
  const user = await requireUser(req);
  if (!allowedRoles.includes(user.role)) {
    throw new HttpError(403, `Rôle insuffisant. Attendu : ${allowedRoles.join(", ")}`);
  }
  return user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
