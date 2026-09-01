import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { supportTemplates } from "../../../db/schema.js";
import {
  DEFAULT_SUPPORT_REPLY_TEMPLATES,
  SUPPORT_TEMPLATE_VARIABLES,
  supportTemplateVariables,
} from "../../../shared/support-reply-templates.js";
import { isSupportAgentTemplateInput } from "../../../shared/support-agent-mutation-input-policy.js";
import {
  isSupportTemplateCreatePayload,
  isSupportTemplateListPayload,
  projectSupportReplyTemplatePayload,
  SUPPORT_TEMPLATE_LIST_LIMIT,
} from "../../../shared/support-template-payload-policy.js";
import { HttpError } from "../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { assertNoForbiddenSupportSecret } from "../../_shared/support.js";
import { requireSupportAgent } from "../../_shared/support-agent-access.js";

const ALLOWED_VARIABLES = new Set<string>(SUPPORT_TEMPLATE_VARIABLES);
const MAX_SAVED_TEMPLATES = SUPPORT_TEMPLATE_LIST_LIMIT - DEFAULT_SUPPORT_REPLY_TEMPLATES.length;
const TEMPLATE_CAPACITY_LOCK = "lyceegest:support-templates:capacity";

function templatePayload(value: unknown, builtIn: boolean) {
  const payload = projectSupportReplyTemplatePayload(value, builtIn);
  if (!payload) throw new HttpError(503, "Modèle de réponse invalide");
  return payload;
}

function templateCreatePayload(template: unknown) {
  const payload = { template };
  if (!isSupportTemplateCreatePayload(payload)) throw new HttpError(503, "Modèle créé invalide");
  return payload;
}

function templateListPayload(templates: unknown[]) {
  const payload = { templates };
  if (!isSupportTemplateListPayload(payload)) throw new HttpError(503, "Liste des modèles invalide");
  return payload;
}

function cleanText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new HttpError(400, `${label} requis`);
  const clean = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
  if (!clean || clean.length > maxLength) throw new HttpError(400, `${label} invalide`);
  return clean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!req.method || !["GET", "POST"].includes(req.method)) {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  return handleApi(res, async () => {
    const { user, access } = await requireSupportAgent(req);

    if (req.method === "POST") {
      if (!access.canManageTemplates) {
        throw new HttpError(403, "Seule la direction peut enregistrer un modèle partagé");
      }
      if (!isSupportAgentTemplateInput(req.body)) {
        throw new HttpError(400, "Contenu du modèle invalide");
      }
      const body = req.body;
      const name = cleanText(body.name, "Nom du modèle", 80);
      const bodyText = cleanText(body.bodyText, "Texte du modèle", 5000);
      assertNoForbiddenSupportSecret(bodyText);
      const category = typeof body.category === "string" && body.category.trim()
        ? cleanText(body.category, "Catégorie", 60)
        : "all";
      const variables = supportTemplateVariables(bodyText);
      if (variables.some((variable) => !ALLOWED_VARIABLES.has(variable))) {
        throw new HttpError(400, "Le modèle contient une variable non autorisée");
      }
      const [created] = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${TEMPLATE_CAPACITY_LOCK}))`);
        const [{ value: activeTemplates }] = await tx
          .select({ value: count() })
          .from(supportTemplates)
          .where(eq(supportTemplates.active, true));
        if (activeTemplates >= MAX_SAVED_TEMPLATES) {
          throw new HttpError(409, "La limite de modèles partagés est atteinte");
        }
        return tx
          .insert(supportTemplates)
          .values({
            category,
            name,
            bodyText,
            allowedVariables: variables,
            createdBy: user.id,
            updatedBy: user.id,
          })
          .returning({
            id: supportTemplates.id,
            category: supportTemplates.category,
            name: supportTemplates.name,
            bodyText: supportTemplates.bodyText,
            allowedVariables: supportTemplates.allowedVariables,
          });
      });
      const payload = templateCreatePayload(templatePayload(created, false));
      res.status(201);
      return payload;
    }

    const saved = await db
      .select({
        id: supportTemplates.id,
        category: supportTemplates.category,
        name: supportTemplates.name,
        bodyText: supportTemplates.bodyText,
        allowedVariables: supportTemplates.allowedVariables,
      })
      .from(supportTemplates)
      .where(eq(supportTemplates.active, true))
      .orderBy(asc(supportTemplates.name))
      .limit(MAX_SAVED_TEMPLATES + 1);
    if (saved.length > MAX_SAVED_TEMPLATES) throw new HttpError(503, "Trop de modèles actifs");

    return templateListPayload([
      ...DEFAULT_SUPPORT_REPLY_TEMPLATES,
      ...saved.map((template) => templatePayload(template, false)),
    ]);
  });
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
