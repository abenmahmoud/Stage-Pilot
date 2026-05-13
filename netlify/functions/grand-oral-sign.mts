import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { fichesGrandOral } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { getUser } from "@netlify/identity";

export default async (req: Request, context: { params: { id: string } }) => {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });

  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ficheId = parseInt(context.params.id);
  if (isNaN(ficheId)) return new Response("Invalid ID", { status: 400 });

  const body = await req.json();
  const comment = body.comment || null;

  const fiches = await db
    .select()
    .from(fichesGrandOral)
    .where(eq(fichesGrandOral.id, ficheId))
    .limit(1);

  if (fiches.length === 0) return new Response("Not found", { status: 404 });

  const fiche = fiches[0];
  const now = new Date();

  let updateData: Record<string, unknown> = {};

  if (fiche.statut === "soumis_prof1") {
    updateData = {
      statut: "valide_prof1",
      commentaireProf1: comment,
      signeProf1At: now,
    };
    if (fiche.profSpe2Id) {
      updateData.statut = "soumis_prof2";
    } else {
      updateData.statut = "soumis_proviseur";
    }
  } else if (fiche.statut === "soumis_prof2") {
    updateData = {
      statut: "soumis_proviseur",
      commentaireProf2: comment,
      signeProf2At: now,
    };
  }

  if (Object.keys(updateData).length === 0) {
    return new Response("Invalid state for signing", { status: 400 });
  }

  const [updated] = await db
    .update(fichesGrandOral)
    .set(updateData)
    .where(eq(fichesGrandOral.id, ficheId))
    .returning();

  return Response.json(updated);
};

export const config: Config = {
  path: "/api/grand-oral/:id/sign",
};
