import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { fichesGrandOral, eleves } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { getUser } from "@netlify/identity";

export default async (req: Request) => {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const identityId = user.id;
  const eleveRows = await db
    .select()
    .from(eleves)
    .where(eq(eleves.identityId, identityId))
    .limit(1);

  if (eleveRows.length === 0) {
    return Response.json({
      id: null,
      statut: "brouillon",
      question1: "",
      question2: "",
      specialitesQuestion1: "",
      specialitesQuestion2: "",
      numeroCanditat: "",
    });
  }

  const eleve = eleveRows[0];

  if (req.method === "GET") {
    const ficheRows = await db
      .select()
      .from(fichesGrandOral)
      .where(eq(fichesGrandOral.eleveId, eleve.id))
      .limit(1);

    if (ficheRows.length === 0) {
      return Response.json({
        id: null,
        statut: "brouillon",
        question1: "",
        question2: "",
      });
    }
    return Response.json(ficheRows[0]);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const submit = body.submit === true;

    const ficheData = {
      eleveId: eleve.id,
      statut: submit ? "soumis_prof1" as const : "brouillon" as const,
      question1: body.question1 || null,
      specialitesQuestion1: body.specialitesQuestion1 || null,
      question2: body.question2 || null,
      specialitesQuestion2: body.specialitesQuestion2 || null,
      numeroCanditat: body.numeroCanditat || null,
      profSpe1Id: body.profSpe1Id || null,
      profSpe2Id: body.profSpe2Id || null,
      soumisAt: submit ? new Date() : null,
    };

    const existing = await db
      .select({ id: fichesGrandOral.id })
      .from(fichesGrandOral)
      .where(eq(fichesGrandOral.eleveId, eleve.id))
      .limit(1);

    let result;
    if (existing.length > 0) {
      const [updated] = await db
        .update(fichesGrandOral)
        .set(ficheData)
        .where(eq(fichesGrandOral.id, existing[0].id))
        .returning();
      result = updated;
    } else {
      const [inserted] = await db
        .insert(fichesGrandOral)
        .values(ficheData)
        .returning();
      result = inserted;
    }

    return Response.json(result);
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/grand-oral/mine",
};
