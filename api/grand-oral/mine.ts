import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { fichesGrandOral, eleves } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireUser } from "../_shared/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  await handleApi(res, async () => {
    const user = await requireUser(req);

    const eleveRows = await db
      .select()
      .from(eleves)
      .where(eq(eleves.authUserId, user.id))
      .limit(1);

    if (eleveRows.length === 0) {
      return {
        id: null,
        statut: "brouillon",
        question1: "",
        question2: "",
        specialitesQuestion1: "",
        specialitesQuestion2: "",
        numeroCanditat: "",
      };
    }

    const eleve = eleveRows[0];

    if (req.method === "GET") {
      const ficheRows = await db
        .select()
        .from(fichesGrandOral)
        .where(eq(fichesGrandOral.eleveId, eleve.id))
        .limit(1);

      if (ficheRows.length === 0) {
        return {
          id: null,
          statut: "brouillon",
          question1: "",
          question2: "",
        };
      }
      return ficheRows[0];
    }

    // POST
    const body = (req.body ?? {}) as Record<string, unknown>;
    const submit = body.submit === true;

    const ficheData = {
      eleveId: eleve.id,
      statut: (submit ? "soumis_prof1" : "brouillon") as string,
      question1: (body.question1 as string) || null,
      specialitesQuestion1: (body.specialitesQuestion1 as string) || null,
      question2: (body.question2 as string) || null,
      specialitesQuestion2: (body.specialitesQuestion2 as string) || null,
      numeroCanditat: (body.numeroCanditat as string) || null,
      profSpe1Id: (body.profSpe1Id as string) || null,
      profSpe2Id: (body.profSpe2Id as string) || null,
      soumisAt: submit ? new Date() : null,
    };

    const existing = await db
      .select({ id: fichesGrandOral.id })
      .from(fichesGrandOral)
      .where(eq(fichesGrandOral.eleveId, eleve.id))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(fichesGrandOral)
        .set(ficheData)
        .where(eq(fichesGrandOral.id, existing[0].id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(fichesGrandOral)
      .values(ficheData as typeof fichesGrandOral.$inferInsert)
      .returning();
    return inserted;
  });
}
