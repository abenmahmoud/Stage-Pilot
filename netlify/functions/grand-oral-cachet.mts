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

  const fiches = await db
    .select()
    .from(fichesGrandOral)
    .where(eq(fichesGrandOral.id, ficheId))
    .limit(1);

  if (fiches.length === 0) return new Response("Not found", { status: 404 });

  if (fiches[0].statut !== "soumis_proviseur") {
    return new Response("Fiche not ready for cachet", { status: 400 });
  }

  const [updated] = await db
    .update(fichesGrandOral)
    .set({
      statut: "finalise",
      cachetApposeAt: new Date(),
    })
    .where(eq(fichesGrandOral.id, ficheId))
    .returning();

  return Response.json(updated);
};

export const config: Config = {
  path: "/api/grand-oral/:id/cachet",
};
