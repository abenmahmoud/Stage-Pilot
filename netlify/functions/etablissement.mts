import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { etablissement } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default async (req: Request) => {
  if (req.method === "GET") {
    const rows = await db.select().from(etablissement).limit(1);
    if (rows.length === 0) {
      const [inserted] = await db
        .insert(etablissement)
        .values({})
        .returning();
      return Response.json(inserted);
    }
    return Response.json(rows[0]);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const rows = await db.select().from(etablissement).limit(1);

    if (rows.length === 0) {
      const [inserted] = await db
        .insert(etablissement)
        .values(body)
        .returning();
      return Response.json(inserted);
    }

    const [updated] = await db
      .update(etablissement)
      .set({
        nom: body.nom,
        adresse: body.adresse,
        codePostal: body.codePostal,
        ville: body.ville,
        telephone: body.telephone,
        email: body.email,
        uai: body.uai,
        nomProviseur: body.nomProviseur,
        civiliteProviseur: body.civiliteProviseur,
        anneeScolaire: body.anneeScolaire,
        dateStageDebut: body.dateStageDebut,
        dateStageFin: body.dateStageFin,
        dateLimiteConvention: body.dateLimiteConvention,
        dateGoDebut: body.dateGoDebut,
        dateGoFin: body.dateGoFin,
        updatedAt: new Date(),
      })
      .where(eq(etablissement.id, rows[0].id))
      .returning();

    return Response.json(updated);
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/etablissement",
};
