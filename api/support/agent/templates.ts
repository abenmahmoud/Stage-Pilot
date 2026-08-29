import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { supportTemplates } from "../../../db/schema.js";
import {
  DEFAULT_SUPPORT_REPLY_TEMPLATES,
  SUPPORT_TEMPLATE_VARIABLES,
  supportTemplateVariables,
} from "../../../shared/support-reply-templates.js";
import { HttpError } from "../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { assertNoForbiddenSupportSecret } from "../../_shared/support.js";
import { requireSupportAgent } from "../../_shared/support-agent-access.js";

const ALLOWED_VARIABLES = new Set<string>(SUPPORT_TEMPLATE_VARIABLES);

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
      const body = (req.body ?? {}) as Record<string, unknown>;
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
      const [created] = await db
        .insert(supportTemplates)
        .values({
          category,
          name,
          bodyText,
          allowedVariables: variables,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();
      res.status(201);
      return { template: created };
    }

    const saved = await db
      .select()
      .from(supportTemplates)
      .where(eq(supportTemplates.active, true))
      .orderBy(asc(supportTemplates.name));

    return {
      templates: [
        ...DEFAULT_SUPPORT_REPLY_TEMPLATES,
        ...saved.map((template) => ({
          id: template.id,
          category: template.category,
          name: template.name,
          bodyText: template.bodyText,
          allowedVariables: Array.isArray(template.allowedVariables)
            ? template.allowedVariables.filter((value): value is string => typeof value === "string")
            : [],
          builtIn: false,
        })),
      ],
    };
  });
}
