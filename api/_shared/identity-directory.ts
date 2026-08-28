import type { VercelRequest } from "@vercel/node";
import { requireAal2 } from "./auth.js";
export { identityDirectoryStoragePath } from "./identity-directory-path.js";
import {
  requireKnowledgeManager,
  type KnowledgeManagerContext,
} from "./knowledge-registry.js";

export const IDENTITY_DIRECTORY_BUCKET = "identity-ingest";

export async function requireIdentityDirectoryManager(
  req: VercelRequest
): Promise<KnowledgeManagerContext> {
  const context = await requireKnowledgeManager(req);
  await requireAal2(req);
  return context;
}
