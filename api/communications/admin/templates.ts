import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { communicationTemplateEvents, communicationTemplates } from "../../../db/schema.js";
import {
  mergeCommunicationTemplates,
  parseCommunicationTemplateInput,
  type CommunicationTemplateKey,
} from "../../../shared/communication-templates.js";
import { HttpError } from "../../_shared/auth.js";
import {
  requireCommunicationEditor,
  requireCommunicationTemplateManager,
} from "../../_shared/communications.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

function invalidTemplate(error: unknown): never {
  if (error instanceof HttpError) throw error;
  const reason = error instanceof Error ? error.message : "input_invalid";
  if (reason === "secret_forbidden") {
    throw new HttpError(400, "Retirez tout mot de passe, code d’accès ou secret du modèle.");
  }
  throw new HttpError(400, "Le modèle est invalide.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      const context = await requireCommunicationEditor(req);
      const rows = await db
        .select({
          id: communicationTemplates.id,
          templateKey: communicationTemplates.templateKey,
          label: communicationTemplates.label,
          defaultCategory: communicationTemplates.defaultCategory,
          titleHint: communicationTemplates.titleHint,
          summaryHint: communicationTemplates.summaryHint,
          bodyMarkdown: communicationTemplates.bodyMarkdown,
          active: communicationTemplates.active,
          version: communicationTemplates.version,
          updatedAt: communicationTemplates.updatedAt,
        })
        .from(communicationTemplates)
        .where(eq(communicationTemplates.institutionId, context.institutionId));
      return {
        templates: mergeCommunicationTemplates(
          rows.map((row) => ({ ...row, templateKey: row.templateKey as CommunicationTemplateKey }))
        ),
      };
    });
  }

  if (req.method === "PATCH") {
    return handleApi(res, async () => {
      const context = await requireCommunicationTemplateManager(req);
      let input;
      try {
        input = parseCommunicationTemplateInput(req.body);
      } catch (error) {
        invalidTemplate(error);
      }

      const result = await db.transaction(async (tx) => {
        const [template] = await tx
          .insert(communicationTemplates)
          .values({
            institutionId: context.institutionId,
            ...input,
            createdBy: context.user.id,
            updatedBy: context.user.id,
          })
          .onConflictDoUpdate({
            target: [communicationTemplates.institutionId, communicationTemplates.templateKey],
            set: {
              label: input.label,
              defaultCategory: input.defaultCategory,
              titleHint: input.titleHint,
              summaryHint: input.summaryHint,
              bodyMarkdown: input.bodyMarkdown,
              active: input.active,
              version: sql`${communicationTemplates.version} + 1`,
              updatedBy: context.user.id,
            },
          })
          .returning();

        await tx.insert(communicationTemplateEvents).values({
          institutionId: context.institutionId,
          templateId: template.id,
          eventType: template.version === 1 ? "template.customized" : "template.updated",
          actorUserId: context.user.id,
          version: template.version,
          summary: { templateKey: template.templateKey, active: template.active },
        });
        return template;
      });
      return { template: result };
    });
  }

  return methodNotAllowed(res, ["GET", "PATCH"]);
}
