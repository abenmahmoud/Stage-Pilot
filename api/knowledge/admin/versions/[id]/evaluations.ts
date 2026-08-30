import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  agentEvaluations,
  agentSkillAudit,
  agentSkillVersions,
} from "../../../../../db/schema.js";
import { parseAgentSkillEvaluationInput } from "../../../../../shared/knowledge-registry-input.js";
import { HttpError } from "../../../../_shared/auth.js";
import {
  registryInputError,
  requireKnowledgeManager,
} from "../../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Version manquante.");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireKnowledgeManager(req, { publish: true });
    const id = routeId(req);
    const [version] = await db
      .select({ id: agentSkillVersions.id, status: agentSkillVersions.status })
      .from(agentSkillVersions)
      .where(
        and(
          eq(agentSkillVersions.id, id),
          eq(agentSkillVersions.institutionId, context.institutionId)
        )
      )
      .limit(1);
    if (!version) throw new HttpError(404, "Version introuvable.");
    if (version.status !== "review") {
      throw new HttpError(409, "Les tests s’exécutent uniquement sur une version figée en validation.");
    }

    let input;
    try {
      input = parseAgentSkillEvaluationInput(req.body);
    } catch (error) {
      registryInputError(error);
    }
    const runAt = new Date();
    return db.transaction(async (tx) => {
      const [evaluation] = await tx
        .insert(agentEvaluations)
        .values({
          institutionId: context.institutionId,
          skillVersionId: id,
          testCaseKey: input.testCaseKey,
          kind: input.kind,
          result: input.result,
          scores: { assertions: 1 },
          evidence: input.evidence,
          runAt,
        })
        .onConflictDoUpdate({
          target: [agentEvaluations.skillVersionId, agentEvaluations.testCaseKey],
          set: {
            kind: input.kind,
            result: input.result,
            scores: { assertions: 1 },
            evidence: input.evidence,
            runAt,
          },
        })
        .returning();
      await tx.insert(agentSkillAudit).values({
        institutionId: context.institutionId,
        resourceType: "version",
        resourceId: id,
        action: "update",
        actorId: context.user.id,
        summary: {
          event: "evaluation_recorded",
          testCaseKey: input.testCaseKey,
          kind: input.kind,
          result: input.result,
          runner: input.evidence.runner,
        },
      });
      return { evaluation };
    });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "32kb" } } };
