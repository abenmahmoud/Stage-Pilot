import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import {
  agentEvaluations,
  agentSkillAudit,
  agentSkills,
  agentSkillVersions,
  knowledgeSources,
  skillSourceLinks,
} from "../../../../../db/schema.js";
import {
  selectActiveSkillVersion,
  validateSkillForPublication,
  type KnowledgeClassification,
  type SkillEvaluation,
  type SkillVersion,
} from "../../../../../shared/skill-registry-policy.js";
import { HttpError } from "../../../../_shared/auth.js";
import { requireKnowledgeManager } from "../../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";

type VersionAction = "submit_review" | "publish" | "retire" | "rollback";

const PUBLICATION_ERROR_LABELS: Record<string, string> = {
  candidate_not_in_review: "la version n’est pas en validation",
  invalid_skill_key: "l’identifiant de compétence est invalide",
  invalid_version: "le numéro de version est invalide",
  owner_required: "le responsable est manquant",
  review_date_invalid: "la date de révision est dépassée ou invalide",
  independent_approval_required: "une validation indépendante est obligatoire",
  source_required: "au moins une source est obligatoire",
  source_missing: "une source liée est introuvable",
  source_unavailable: "une source est retirée ou périmée",
  source_not_current: "une source n’est pas actuellement valide",
  source_scope_mismatch: "une source appartient à un autre établissement",
  source_metadata_incomplete: "les informations d’une source sont incomplètes",
  allowed_tool_invalid: "un outil autorisé est invalide",
  test_coverage_incomplete: "il faut 5 tests normaux, 3 ambigus et 3 interdits",
  test_evidence_missing: "un test ne possède pas de preuve complète",
  test_run_invalid: "un test n’a pas été exécuté après le gel de la version",
  test_failed: "un test a échoué ou reste à vérifier",
};

function routeId(req: VercelRequest): string {
  const value = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!value) throw new HttpError(400, "Version manquante.");
  return value;
}

function actionFromBody(body: unknown): VersionAction {
  const value = body && typeof body === "object"
    ? (body as Record<string, unknown>).action
    : null;
  if (![
    "submit_review",
    "publish",
    "retire",
    "rollback",
  ].includes(String(value))) {
    throw new HttpError(400, "Action invalide.");
  }
  return value as VersionAction;
}

function definitionFields(value: unknown): {
  ownerUserId: string;
  allowedTools: string[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(409, "La définition de la compétence est invalide.");
  }
  const definition = value as Record<string, unknown>;
  if (typeof definition.ownerUserId !== "string") {
    throw new HttpError(409, "Le responsable de la compétence est manquant.");
  }
  return {
    ownerUserId: definition.ownerUserId,
    allowedTools: Array.isArray(definition.allowedTools)
      ? definition.allowedTools.filter((tool): tool is string => typeof tool === "string")
      : [],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const action = actionFromBody(req.body);
    const context = await requireKnowledgeManager(req, {
      publish: action !== "submit_review",
    });
    const id = routeId(req);
    const [current] = await db
      .select({ version: agentSkillVersions, skill: agentSkills })
      .from(agentSkillVersions)
      .innerJoin(agentSkills, eq(agentSkillVersions.skillId, agentSkills.id))
      .where(
        and(
          eq(agentSkillVersions.id, id),
          eq(agentSkillVersions.institutionId, context.institutionId)
        )
      )
      .limit(1);
    if (!current) throw new HttpError(404, "Version introuvable.");

    if (action === "submit_review") {
      if (current.version.status !== "draft") {
        throw new HttpError(409, "Seul un brouillon peut être envoyé en validation.");
      }
      return db.transaction(async (tx) => {
        const [version] = await tx
          .update(agentSkillVersions)
          .set({ status: "review" })
          .where(eq(agentSkillVersions.id, id))
          .returning();
        await tx.delete(agentEvaluations).where(
          and(
            eq(agentEvaluations.institutionId, context.institutionId),
            eq(agentEvaluations.skillVersionId, id)
          )
        );
        await tx.insert(agentSkillAudit).values({
          institutionId: context.institutionId,
          resourceType: "version",
          resourceId: id,
          action: "submit_review",
          actorId: context.user.id,
          summary: { version: current.version.version, evaluationProtocol: "evidence_required" },
        });
        return { version };
      });
    }

    const links = await db
      .select({ sourceId: skillSourceLinks.sourceId })
      .from(skillSourceLinks)
      .where(
        and(
          eq(skillSourceLinks.institutionId, context.institutionId),
          eq(skillSourceLinks.skillVersionId, id)
        )
      );
    const sourceIds = links.map((link) => link.sourceId);
    const sources = sourceIds.length > 0
      ? await db
          .select()
          .from(knowledgeSources)
          .where(
            and(
              eq(knowledgeSources.institutionId, context.institutionId),
              inArray(knowledgeSources.id, sourceIds)
            )
          )
      : [];
    const evaluations = await db
      .select()
      .from(agentEvaluations)
      .where(
        and(
          eq(agentEvaluations.institutionId, context.institutionId),
          eq(agentEvaluations.skillVersionId, id)
        )
      );
    const definition = definitionFields(current.version.definition);
    const candidate: SkillVersion = {
      id,
      institutionId: context.institutionId,
      skillKey: current.skill.skillKey,
      version: current.version.version,
      status: current.version.status as SkillVersion["status"],
      ownerUserId: definition.ownerUserId,
      createdBy: current.version.createdBy,
      approvedBy: context.user.id,
      dataClassification: current.version.dataClassification as KnowledgeClassification,
      sourceIds,
      allowedTools: definition.allowedTools,
      evaluations: evaluations.map((evaluation) => ({
        testCaseKey: evaluation.testCaseKey,
        kind: evaluation.kind,
        result: evaluation.result,
        evidence: evaluation.evidence,
        runAt: evaluation.runAt.toISOString(),
      })) as SkillEvaluation[],
      publishedAt: current.version.publishedAt?.toISOString() ?? null,
      reviewDueAt: current.version.reviewDueAt.toISOString(),
    };
    const policySources = sources.map((source) => ({
      id: source.id,
      institutionId: source.institutionId,
      serviceCodes: source.serviceCodes,
      status: source.status as "draft" | "published" | "expired" | "revoked",
      classification: source.classification as KnowledgeClassification,
      ownerUserId: source.ownerUserId,
      validFrom: source.validFrom.toISOString(),
      expiresAt: source.expiresAt?.toISOString() ?? null,
      checksum: source.checksum,
    }));

    if (action === "publish") {
      if (current.version.status !== "review") {
        throw new HttpError(409, "La version doit d’abord être envoyée en validation.");
      }
      const validation = validateSkillForPublication({
        candidate,
        sources: policySources,
        now: new Date().toISOString(),
        evaluationNotBefore: current.version.updatedAt.toISOString(),
      });
      if (!validation.ok) {
        throw new HttpError(
          409,
          `Publication bloquée : ${validation.errors
            .map((error) => PUBLICATION_ERROR_LABELS[error] ?? error)
            .join(" ; ")}.`
        );
      }
      const now = new Date();
      return db.transaction(async (tx) => {
        const [version] = await tx
          .update(agentSkillVersions)
          .set({ status: "published", approvedBy: context.user.id, publishedAt: now })
          .where(eq(agentSkillVersions.id, id))
          .returning();
        const [skill] = await tx
          .update(agentSkills)
          .set({ activeVersionId: id, enabled: true })
          .where(eq(agentSkills.id, current.skill.id))
          .returning();
        await tx.insert(agentSkillAudit).values({
          institutionId: context.institutionId,
          resourceType: "version",
          resourceId: id,
          action: "publish",
          actorId: context.user.id,
          summary: { version: current.version.version, sourceCount: sourceIds.length },
        });
        return { skill, version };
      });
    }

    if (action === "rollback") {
      if (current.version.status !== "published") {
        throw new HttpError(409, "Seule une version publiée peut être réactivée.");
      }
      const eligible = selectActiveSkillVersion({
        versions: [candidate],
        sources: policySources,
        now: new Date().toISOString(),
      });
      if (!eligible) throw new HttpError(409, "Cette version ou sa source est périmée.");
      const [skill] = await db
        .update(agentSkills)
        .set({ activeVersionId: id, enabled: true })
        .where(eq(agentSkills.id, current.skill.id))
        .returning();
      await db.insert(agentSkillAudit).values({
        institutionId: context.institutionId,
        resourceType: "version",
        resourceId: id,
        action: "rollback",
        actorId: context.user.id,
        summary: { version: current.version.version },
      });
      return { skill };
    }

    if (current.version.status === "retired") {
      throw new HttpError(409, "Cette version est déjà retirée.");
    }
    return db.transaction(async (tx) => {
      const [version] = await tx
        .update(agentSkillVersions)
        .set({ status: "retired" })
        .where(eq(agentSkillVersions.id, id))
        .returning();
      let skill = current.skill;
      if (current.skill.activeVersionId === id) {
        [skill] = await tx
          .update(agentSkills)
          .set({ activeVersionId: null, enabled: false })
          .where(eq(agentSkills.id, current.skill.id))
          .returning();
      }
      await tx.insert(agentSkillAudit).values({
        institutionId: context.institutionId,
        resourceType: "version",
        resourceId: id,
        action: "retire",
        actorId: context.user.id,
        summary: { version: current.version.version },
      });
      return { skill, version };
    });
  });
}
