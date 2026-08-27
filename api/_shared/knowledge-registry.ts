import type { VercelRequest } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { institutions } from "../../db/schema.js";
import { HttpError, requireAal2 } from "./auth.js";
import { requireSupportAgent, type SupportAgentContext } from "./support-agent-access.js";

const DEFAULT_INSTITUTION_SLUG = "blaise-cendrars-sevran";

export type KnowledgeManagerContext = SupportAgentContext & {
  institutionId: string;
};

export async function requireKnowledgeManager(
  req: VercelRequest,
  options: { publish?: boolean } = {}
): Promise<KnowledgeManagerContext> {
  const context = await requireSupportAgent(req);
  if (!context.access.canViewAll) {
    throw new HttpError(403, "La gestion des connaissances est réservée à la direction.");
  }
  if (options.publish) await requireAal2(req);
  const slug = process.env.SUPPORT_INSTITUTION_SLUG?.trim() || DEFAULT_INSTITUTION_SLUG;
  const [institution] = await db
    .select({ id: institutions.id })
    .from(institutions)
    .where(eq(institutions.slug, slug))
    .limit(1);
  if (!institution) throw new HttpError(503, "Établissement de preview introuvable.");
  return { ...context, institutionId: institution.id };
}

export function registryInputError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  throw new HttpError(
    400,
    error instanceof Error ? error.message : "Les données du registre sont invalides."
  );
}
