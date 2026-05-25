import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { fichesGrandOral } from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { requireRole, HttpError } from "../../_shared/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  await handleApi(res, async () => {
    await requireRole(req, ["superadmin", "proviseur"]);

    const ficheId = (req.query.id as string) || "";
    if (!ficheId || !/^[0-9a-fA-F-]{36}$/.test(ficheId)) {
      throw new HttpError(400, "Identifiant fiche invalide");
    }

    const fiches = await db
      .select()
      .from(fichesGrandOral)
      .where(eq(fichesGrandOral.id, ficheId))
      .limit(1);

    if (fiches.length === 0) throw new HttpError(404, "Fiche introuvable");

    if (fiches[0].statut !== "soumis_proviseur") {
      throw new HttpError(
        400,
        "Fiche pas prête pour cachet (les deux profs spé doivent avoir signé)"
      );
    }

    const now = new Date();
    const pdfUrl = `/api/grand-oral/${ficheId}/pdf`;

    const [updated] = await db
      .update(fichesGrandOral)
      .set({
        statut: "finalise",
        cachetApposeAt: now,
        signatureProviseurUrl: "signature-proviseur-lyceegest",
        fichePdfUrl: pdfUrl,
        pdfGenereAt: now,
      })
      .where(eq(fichesGrandOral.id, ficheId))
      .returning();

    return updated;
  });
}
