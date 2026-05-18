import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../db/index.js";
import { professeurs } from "../db/schema.js";
import { handleApi, methodNotAllowed } from "./_shared/response.js";
import { requireUser } from "./_shared/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  await handleApi(res, async () => {
    await requireUser(req);
    const all = await db
      .select({
        id: professeurs.id,
        nom: professeurs.nom,
        prenom: professeurs.prenom,
        email: professeurs.email,
        matieres: professeurs.matieres,
        role: professeurs.role,
      })
      .from(professeurs);
    return all;
  });
}
