import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { eleves, classes, stages, importLogs } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireRole } from "../_shared/auth.js";

type EleveRow = {
  nom: string;
  prenom: string;
  classe: string;
  emailEleve?: string;
  emailFamille?: string;
  telephoneFamille?: string;
  dateNaissance?: string;
};

/**
 * Détecte le niveau scolaire à partir du code de classe.
 *
 * Règles, dans l'ordre :
 *   - commence par "T" (TG1, TSTMG2, TMELEC2, TPRO...) → terminale
 *   - commence par "2" (2E1, 2E12, 2PRO1...)          → seconde
 *   - commence par "1" (1G3, 1STMG1, 1MELEC2...)      → premiere
 *   - autre / inconnu                                  → autre
 *
 * Important : on regarde le PREMIER caractère, pas une recherche de substring,
 * sinon "2E1" contenait "1" et était classé en première (bug v1).
 */
function detectNiveau(classeNom: string): string {
  const c = classeNom.trim().toUpperCase();
  if (c.startsWith("T")) return "terminale";
  if (c.startsWith("2")) return "seconde";
  if (c.startsWith("1")) return "premiere";
  return "autre";
}

/**
 * Convertit une date au format français "JJ/MM/AAAA" en format ISO "AAAA-MM-JJ".
 * Retourne null si vide ou invalide (pour éviter de casser l'insert).
 */
function parseDateFR(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  if (!s) return null;
  // Déjà au format ISO ?
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Format JJ/MM/AAAA
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

/**
 * Génère un code d'accès lisible et unique : "NOM-CLASSE-XXXX"
 * Le NOM est slugifié (ASCII upper, sans accents, sans espaces).
 */
function genererCodeAcces(nom: string, classe: string): string {
  const nomSlug = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12); // max 12 chars pour rester lisible
  const classeSlug = classe.replace(/\s+/g, "").toUpperCase();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${nomSlug}-${classeSlug}-${rand}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  await handleApi(res, async () => {
    const user = await requireRole(req, ["superadmin", "administration"]);

    const body = (req.body ?? {}) as { rows?: EleveRow[] };
    const rows = body.rows ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return { imported: 0, doublons: 0, erreurs: 0 };
    }

    let imported = 0;
    let doublons = 0;
    let erreurs = 0;
    const erreursDetails: Array<{ ligne: number; raison: string }> = [];

    // ÉTAPE 1 — pré-calculer toutes les classes uniques et les créer en batch
    const classesUniques = Array.from(
      new Set(rows.map((r) => r.classe.trim()).filter(Boolean))
    );

    // Récupérer les classes existantes en une seule requête
    const classesExistantes = await db
      .select()
      .from(classes)
      .where(inArray(classes.nom, classesUniques));

    const classeMap = new Map<string, string>(); // nom -> id
    const classeNiveauMap = new Map<string, string>(); // id -> niveau
    for (const c of classesExistantes) {
      classeMap.set(c.nom, c.id);
      classeNiveauMap.set(c.id, c.niveau);
    }

    // Créer les classes manquantes en bulk insert
    const classesAcreer = classesUniques
      .filter((nom) => !classeMap.has(nom))
      .map((nom) => ({ nom, niveau: detectNiveau(nom) }));

    if (classesAcreer.length > 0) {
      const nouvellesClasses = await db
        .insert(classes)
        .values(classesAcreer)
        .returning();
      for (const c of nouvellesClasses) {
        classeMap.set(c.nom, c.id);
        classeNiveauMap.set(c.id, c.niveau);
      }
    }

    // ÉTAPE 2 — pré-charger les élèves existants (pour détecter doublons en mémoire)
    const cleDoublon = (r: { nom: string; prenom: string; classeId: string }) =>
      `${r.nom.toUpperCase()}|${r.prenom.toUpperCase()}|${r.classeId}`;

    const elevesExistants = await db
      .select({
        id: eleves.id,
        nom: eleves.nom,
        prenom: eleves.prenom,
        classeId: eleves.classeId,
      })
      .from(eleves);

    const elevesExistantsSet = new Set(
      elevesExistants
        .filter((e) => e.classeId !== null)
        .map((e) =>
          cleDoublon({
            nom: e.nom,
            prenom: e.prenom,
            classeId: e.classeId as string,
          })
        )
    );

    // ÉTAPE 3 — construire les batches d'insert
    const elevesAcreer: Array<typeof eleves.$inferInsert> = [];
    const seenInBatch = new Set<string>(); // éviter les doublons dans le CSV lui-même

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const classeNom = row.classe.trim();
        const classeId = classeMap.get(classeNom);
        if (!classeId) {
          erreurs++;
          erreursDetails.push({
            ligne: i + 1,
            raison: `Classe inconnue: ${classeNom}`,
          });
          continue;
        }

        const cle = cleDoublon({
          nom: row.nom.trim(),
          prenom: row.prenom.trim(),
          classeId,
        });

        if (elevesExistantsSet.has(cle) || seenInBatch.has(cle)) {
          doublons++;
          continue;
        }
        seenInBatch.add(cle);

        elevesAcreer.push({
          nom: row.nom.trim(),
          prenom: row.prenom.trim(),
          classeId,
          emailEleve: row.emailEleve?.trim() || null,
          emailFamille: row.emailFamille?.trim() || null,
          telephoneFamille: row.telephoneFamille?.trim() || null,
          dateNaissance: parseDateFR(row.dateNaissance),
          codeAcces: genererCodeAcces(row.nom, classeNom),
        });
      } catch (err) {
        erreurs++;
        erreursDetails.push({
          ligne: i + 1,
          raison: err instanceof Error ? err.message : "Erreur inconnue",
        });
      }
    }

    // ÉTAPE 4 — insert élèves par batch de 50, puis stages par batch de 50
    // Postgres supporte facilement des bulk inserts de 1000+ lignes,
    // mais 50 permet de garder le payload SQL raisonnable.
    const BATCH_SIZE = 50;
    const insertedElevesPourStage: Array<{
      id: string;
      classeId: string | null;
    }> = [];

    for (let i = 0; i < elevesAcreer.length; i += BATCH_SIZE) {
      const batch = elevesAcreer.slice(i, i + BATCH_SIZE);
      const inserted = await db
        .insert(eleves)
        .values(batch)
        .returning({ id: eleves.id, classeId: eleves.classeId });
      for (const e of inserted) insertedElevesPourStage.push(e);
      imported += inserted.length;
    }

    // Créer un stage vide uniquement pour les secondes.
    const insertedEleveIdsStage = insertedElevesPourStage
      .filter((e) => e.classeId && classeNiveauMap.get(e.classeId) === "seconde")
      .map((e) => e.id);
    for (let i = 0; i < insertedEleveIdsStage.length; i += BATCH_SIZE) {
      const batch = insertedEleveIdsStage.slice(i, i + BATCH_SIZE);
      await db
        .insert(stages)
        .values(batch.map((eleveId) => ({ eleveId, statut: "a_completer" })));
    }

    // ÉTAPE 5 — journal d'import
    await db.insert(importLogs).values({
      type: "eleves",
      fichierNom: "csv_import",
      nbImportes: imported,
      nbDoublons: doublons,
      nbErreurs: erreurs,
      detailErreurs: erreursDetails.length > 0 ? erreursDetails : null,
      importePar: user.email,
    });

    return {
      imported,
      doublons,
      erreurs,
      detailErreurs: erreursDetails.slice(0, 10), // top 10 erreurs pour debug
    };
  });
}
