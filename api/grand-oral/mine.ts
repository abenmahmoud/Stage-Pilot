import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { fichesGrandOral, eleves, classes } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireUser, HttpError } from "../_shared/auth.js";
import { isGrandOralModuleActive } from "../_shared/modules.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  await handleApi(res, async () => {
    const user = await requireUser(req);

    const eleveRows = await db
      .select({
        id: eleves.id,
        classeNiveau: classes.niveau,
      })
      .from(eleves)
      .leftJoin(classes, eq(eleves.classeId, classes.id))
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
    const ficheRows = await db
      .select()
      .from(fichesGrandOral)
      .where(eq(fichesGrandOral.eleveId, eleve.id))
      .limit(1);

    const existingFiche = ficheRows[0] ?? null;
    const moduleActif = isGrandOralModuleActive(
      eleve.classeNiveau,
      existingFiche?.statut
    );

    if (req.method === "GET") {
      if (!moduleActif) {
        return {
          moduleActif: false,
          id: existingFiche?.id ?? null,
          statut: "module_desactive",
          question1: "",
          question2: "",
        };
      }

      if (!existingFiche) {
        return {
          moduleActif: true,
          id: null,
          statut: "brouillon",
          question1: "",
          question2: "",
        };
      }
      return { ...existingFiche, moduleActif: true };
    }

    if (!moduleActif) {
      throw new HttpError(
        403,
        "Le module Grand Oral n'est pas activé pour cet élève."
      );
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

    if (existingFiche) {
      const [updated] = await db
        .update(fichesGrandOral)
        .set(ficheData)
        .where(eq(fichesGrandOral.id, existingFiche.id))
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
