import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, desc, eq, ne, and } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { siteContentAudit, siteContentTemplates } from "../../../db/schema.js";
import { parseSiteTemplateInput } from "../../../shared/site-content.js";
import { HttpError } from "../../_shared/auth.js";
import { inputError, requireSiteEditor, requireSitePublisher } from "../../_shared/site-content.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return handleApi(res, async () => {
      await requireSiteEditor(req);
      const templates = await db
        .select()
        .from(siteContentTemplates)
        .orderBy(desc(siteContentTemplates.active), asc(siteContentTemplates.name));
      return { templates };
    });
  }

  if (req.method === "POST" || req.method === "PATCH") {
    return handleApi(res, async () => {
      const user = await requireSitePublisher(req);
      let input;
      try {
        input = parseSiteTemplateInput(req.body);
      } catch (error) {
        inputError(error);
      }
      if (req.method === "POST") {
        const [existing] = await db
          .select({ id: siteContentTemplates.id })
          .from(siteContentTemplates)
          .where(eq(siteContentTemplates.slug, input.slug))
          .limit(1);
        if (existing) throw new HttpError(409, "Ce nom de modèle est déjà utilisé");
        const { id: _id, ...templateValues } = input;
        const [template] = await db
          .insert(siteContentTemplates)
          .values({ ...templateValues, createdBy: user.id, updatedBy: user.id })
          .returning();
        await db.insert(siteContentAudit).values({
          resourceType: "template",
          resourceId: template.id,
          action: "create",
          actorId: user.id,
          summary: { version: 1 },
        });
        return { template };
      }

      if (!input.id) throw new HttpError(400, "Modèle manquant");
      const [current] = await db
        .select()
        .from(siteContentTemplates)
        .where(eq(siteContentTemplates.id, input.id))
        .limit(1);
      if (!current) throw new HttpError(404, "Modèle introuvable");
      const [conflict] = await db
        .select({ id: siteContentTemplates.id })
        .from(siteContentTemplates)
        .where(and(eq(siteContentTemplates.slug, input.slug), ne(siteContentTemplates.id, input.id)))
        .limit(1);
      if (conflict) throw new HttpError(409, "Ce nom de modèle est déjà utilisé");
      const [template] = await db
        .update(siteContentTemplates)
        .set({
          slug: input.slug,
          name: input.name,
          contentType: input.contentType,
          description: input.description,
          defaultTitle: input.defaultTitle,
          defaultSummary: input.defaultSummary,
          defaultBodyMarkdown: input.defaultBodyMarkdown,
          active: input.active,
          version: current.version + 1,
          updatedBy: user.id,
        })
        .where(eq(siteContentTemplates.id, input.id))
        .returning();
      await db.insert(siteContentAudit).values({
        resourceType: "template",
        resourceId: template.id,
        action: "update",
        actorId: user.id,
        summary: { version: template.version, active: template.active },
      });
      return { template };
    });
  }

  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
}
