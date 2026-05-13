import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { stages, eleves } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
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
      statut: "a_completer",
      entrepriseNom: "",
      entrepriseRepresentant: "",
      entrepriseQualite: "",
      entrepriseAdresse: "",
      entrepriseTelephone: "",
      entrepriseEmail: "",
      entrepriseType: "",
      tuteurNomQualite: "",
      tuteurEmail: "",
      tuteurTelephone: "",
      faitLe: "",
      horaires: {},
    });
  }

  const eleve = eleveRows[0];

  if (req.method === "GET") {
    const stageRows = await db
      .select()
      .from(stages)
      .where(eq(stages.eleveId, eleve.id))
      .limit(1);

    if (stageRows.length === 0) {
      return Response.json({
        id: null,
        statut: "a_completer",
        entrepriseNom: "",
        horaires: {},
      });
    }

    const s = stageRows[0];
    const horaires: Record<string, string> = {};
    const jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
    for (const jour of jours) {
      for (const periode of ["matin", "apm"]) {
        for (const bound of ["debut", "fin"]) {
          const key = `horaire${jour.charAt(0).toUpperCase() + jour.slice(1)}${periode === "matin" ? "Matin" : "Apm"}${bound === "debut" ? "Debut" : "Fin"}`;
          const val = (s as Record<string, unknown>)[key];
          if (typeof val === "string" && val) {
            horaires[`${jour}_${periode}_${bound}`] = val;
          }
        }
      }
    }

    return Response.json({ ...s, horaires });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const submit = body.submit === true;

    const stageData: Record<string, unknown> = {
      eleveId: eleve.id,
      statut: submit ? "soumis" : "en_cours_saisie",
      entrepriseNom: body.entrepriseNom || null,
      entrepriseRepresentant: body.entrepriseRepresentant || null,
      entrepriseQualite: body.entrepriseQualite || null,
      entrepriseAdresse: body.entrepriseAdresse || null,
      entrepriseTelephone: body.entrepriseTelephone || null,
      entrepriseEmail: body.entrepriseEmail || null,
      entrepriseType: body.entrepriseType || null,
      tuteurNomQualite: body.tuteurNomQualite || null,
      tuteurEmail: body.tuteurEmail || null,
      tuteurTelephone: body.tuteurTelephone || null,
      faitLe: body.faitLe || null,
    };

    if (submit) {
      stageData.soumisAt = new Date();
    }

    const horaires = body.horaires || {};
    const jourMap: Record<string, string> = {
      lundi: "Lundi",
      mardi: "Mardi",
      mercredi: "Mercredi",
      jeudi: "Jeudi",
      vendredi: "Vendredi",
    };
    for (const [jour, cap] of Object.entries(jourMap)) {
      for (const periode of ["matin", "apm"]) {
        for (const bound of ["debut", "fin"]) {
          const hKey = `${jour}_${periode}_${bound}`;
          const dbKey = `horaire${cap}${periode === "matin" ? "Matin" : "Apm"}${bound === "debut" ? "Debut" : "Fin"}`;
          stageData[dbKey] = horaires[hKey] || null;
        }
      }
    }

    const existing = await db
      .select({ id: stages.id })
      .from(stages)
      .where(eq(stages.eleveId, eleve.id))
      .limit(1);

    let result;
    if (existing.length > 0) {
      const [updated] = await db
        .update(stages)
        .set(stageData)
        .where(eq(stages.id, existing[0].id))
        .returning();
      result = updated;
    } else {
      const [inserted] = await db.insert(stages).values(stageData).returning();
      result = inserted;
    }

    return Response.json(result);
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/stages/mine",
};
