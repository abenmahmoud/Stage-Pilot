import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { stages, eleves, classes, professeurs } from "../../db/schema.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { requireUser, HttpError, type AuthUser } from "../_shared/auth.js";
import { isStageModuleActive } from "../_shared/modules.js";
import {
  canReadStageForUser,
  getProfesseurIdForUser,
  isGlobalStaff,
} from "../_shared/access.js";

const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"] as const;

type DayKey = (typeof DAYS)[number];

type DayEntry = {
  activites: string;
  apprentissages: string;
  questions: string;
};

type SuiviProf = {
  dateVisite: string;
  modeContact: string;
  observations: string;
  pointsVigilance: string;
  appreciation: string;
  prochaineAction: string;
};

type LivretStage = {
  attentes: string;
  objectifs: string;
  questionsAvantStage: string;
  presentationEntreprise: string;
  metiersObserves: string;
  reglesSecurite: string;
  journal: Record<DayKey, DayEntry>;
  activitesPreferees: string;
  competencesDecouvertes: string;
  difficultes: string;
  bilanPersonnel: string;
  projetOrientation: string;
  soumisEleveAt: string;
  suiviProf: SuiviProf;
};

type StageLivretRow = {
  id: string;
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  eleveAuthUserId: string | null;
  classeNom: string | null;
  classeNiveau: string | null;
  professeurPrincipalId: string | null;
  statut: string;
  professeurReferentId: string | null;
  professeurReferentNom: string | null;
  professeurReferentPrenom: string | null;
  entrepriseNom: string | null;
  entrepriseAdresse: string | null;
  entrepriseTelephone: string | null;
  entrepriseEmail: string | null;
  tuteurNomQualite: string | null;
  tuteurEmail: string | null;
  tuteurTelephone: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  notesSuivi: string | null;
  dateVisite: string | null;
  compteRenduVisite: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function emptyDay(): DayEntry {
  return { activites: "", apprentissages: "", questions: "" };
}

function emptyJournal(): Record<DayKey, DayEntry> {
  return {
    lundi: emptyDay(),
    mardi: emptyDay(),
    mercredi: emptyDay(),
    jeudi: emptyDay(),
    vendredi: emptyDay(),
  };
}

function emptyLivret(): LivretStage {
  return {
    attentes: "",
    objectifs: "",
    questionsAvantStage: "",
    presentationEntreprise: "",
    metiersObserves: "",
    reglesSecurite: "",
    journal: emptyJournal(),
    activitesPreferees: "",
    competencesDecouvertes: "",
    difficultes: "",
    bilanPersonnel: "",
    projetOrientation: "",
    soumisEleveAt: "",
    suiviProf: {
      dateVisite: "",
      modeContact: "",
      observations: "",
      pointsVigilance: "",
      appreciation: "",
      prochaineAction: "",
    },
  };
}

function parseDay(value: unknown): DayEntry {
  if (!isRecord(value)) return emptyDay();
  return {
    activites: readString(value, "activites"),
    apprentissages: readString(value, "apprentissages"),
    questions: readString(value, "questions"),
  };
}

function parseLivret(
  notesSuivi: string | null,
  dateVisite: string | null,
  compteRenduVisite: string | null
): LivretStage {
  const base = emptyLivret();
  let parsed: Record<string, unknown> | null = null;

  if (notesSuivi?.trim()) {
    try {
      const raw = JSON.parse(notesSuivi) as unknown;
      if (isRecord(raw)) parsed = raw;
    } catch {
      parsed = null;
    }
  }

  if (!parsed) {
    return {
      ...base,
      suiviProf: {
        ...base.suiviProf,
        dateVisite: dateVisite ?? "",
        observations: compteRenduVisite ?? notesSuivi ?? "",
      },
    };
  }

  const journalSource = isRecord(parsed.journal) ? parsed.journal : {};
  const suiviSource = isRecord(parsed.suiviProf) ? parsed.suiviProf : {};

  return {
    attentes: readString(parsed, "attentes"),
    objectifs: readString(parsed, "objectifs"),
    questionsAvantStage: readString(parsed, "questionsAvantStage"),
    presentationEntreprise: readString(parsed, "presentationEntreprise"),
    metiersObserves: readString(parsed, "metiersObserves"),
    reglesSecurite: readString(parsed, "reglesSecurite"),
    journal: {
      lundi: parseDay(journalSource.lundi),
      mardi: parseDay(journalSource.mardi),
      mercredi: parseDay(journalSource.mercredi),
      jeudi: parseDay(journalSource.jeudi),
      vendredi: parseDay(journalSource.vendredi),
    },
    activitesPreferees: readString(parsed, "activitesPreferees"),
    competencesDecouvertes: readString(parsed, "competencesDecouvertes"),
    difficultes: readString(parsed, "difficultes"),
    bilanPersonnel: readString(parsed, "bilanPersonnel"),
    projetOrientation: readString(parsed, "projetOrientation"),
    soumisEleveAt: readString(parsed, "soumisEleveAt"),
    suiviProf: {
      dateVisite: readString(suiviSource, "dateVisite") || dateVisite || "",
      modeContact: readString(suiviSource, "modeContact"),
      observations:
        readString(suiviSource, "observations") || compteRenduVisite || "",
      pointsVigilance: readString(suiviSource, "pointsVigilance"),
      appreciation: readString(suiviSource, "appreciation"),
      prochaineAction: readString(suiviSource, "prochaineAction"),
    },
  };
}

function mergeEleveFields(current: LivretStage, incoming: unknown): LivretStage {
  if (!isRecord(incoming)) return current;
  const journalSource = isRecord(incoming.journal) ? incoming.journal : {};

  return {
    ...current,
    attentes: readString(incoming, "attentes"),
    objectifs: readString(incoming, "objectifs"),
    questionsAvantStage: readString(incoming, "questionsAvantStage"),
    presentationEntreprise: readString(incoming, "presentationEntreprise"),
    metiersObserves: readString(incoming, "metiersObserves"),
    reglesSecurite: readString(incoming, "reglesSecurite"),
    journal: {
      lundi: parseDay(journalSource.lundi),
      mardi: parseDay(journalSource.mardi),
      mercredi: parseDay(journalSource.mercredi),
      jeudi: parseDay(journalSource.jeudi),
      vendredi: parseDay(journalSource.vendredi),
    },
    activitesPreferees: readString(incoming, "activitesPreferees"),
    competencesDecouvertes: readString(incoming, "competencesDecouvertes"),
    difficultes: readString(incoming, "difficultes"),
    bilanPersonnel: readString(incoming, "bilanPersonnel"),
    projetOrientation: readString(incoming, "projetOrientation"),
    soumisEleveAt: readString(incoming, "soumisEleveAt"),
  };
}

function mergeSuiviFields(current: LivretStage, incoming: unknown): LivretStage {
  if (!isRecord(incoming)) return current;
  const suiviSource = isRecord(incoming.suiviProf) ? incoming.suiviProf : {};
  return {
    ...current,
    suiviProf: {
      dateVisite: readString(suiviSource, "dateVisite"),
      modeContact: readString(suiviSource, "modeContact"),
      observations: readString(suiviSource, "observations"),
      pointsVigilance: readString(suiviSource, "pointsVigilance"),
      appreciation: readString(suiviSource, "appreciation"),
      prochaineAction: readString(suiviSource, "prochaineAction"),
    },
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(value);
}

async function resolveEleveId(req: VercelRequest, user: AuthUser): Promise<string> {
  if (user.role === "eleve") {
    const [eleve] = await db
      .select({ id: eleves.id })
      .from(eleves)
      .where(eq(eleves.authUserId, user.id))
      .limit(1);
    if (!eleve) throw new HttpError(404, "Eleve introuvable");
    return eleve.id;
  }

  const eleveId = (req.query.eleveId as string) || "";
  if (!eleveId || !isUuid(eleveId)) {
    throw new HttpError(400, "Identifiant eleve invalide");
  }
  return eleveId;
}

async function loadStage(eleveId: string): Promise<StageLivretRow | null> {
  const [stage] = await db
    .select({
      id: stages.id,
      eleveId: stages.eleveId,
      eleveNom: eleves.nom,
      elevePrenom: eleves.prenom,
      eleveAuthUserId: eleves.authUserId,
      classeNom: classes.nom,
      classeNiveau: classes.niveau,
      professeurPrincipalId: classes.professeurPrincipalId,
      statut: stages.statut,
      professeurReferentId: stages.professeurReferentId,
      professeurReferentNom: professeurs.nom,
      professeurReferentPrenom: professeurs.prenom,
      entrepriseNom: stages.entrepriseNom,
      entrepriseAdresse: stages.entrepriseAdresse,
      entrepriseTelephone: stages.entrepriseTelephone,
      entrepriseEmail: stages.entrepriseEmail,
      tuteurNomQualite: stages.tuteurNomQualite,
      tuteurEmail: stages.tuteurEmail,
      tuteurTelephone: stages.tuteurTelephone,
      dateDebut: stages.dateDebut,
      dateFin: stages.dateFin,
      notesSuivi: stages.notesSuivi,
      dateVisite: stages.dateVisite,
      compteRenduVisite: stages.compteRenduVisite,
    })
    .from(stages)
    .innerJoin(eleves, eq(stages.eleveId, eleves.id))
    .leftJoin(classes, eq(eleves.classeId, classes.id))
    .leftJoin(
      professeurs,
      or(
        eq(stages.professeurReferentId, professeurs.id),
        eq(stages.professeurReferentId, professeurs.authUserId)
      )
    )
    .where(eq(stages.eleveId, eleveId))
    .limit(1);

  return stage ?? null;
}

function formatResponse(
  stage: StageLivretRow,
  livret: LivretStage,
  canEditEleve: boolean,
  canEditSuivi: boolean
) {
  return {
    stage: {
      id: stage.id,
      eleveId: stage.eleveId,
      eleveNom: stage.eleveNom,
      elevePrenom: stage.elevePrenom,
      classeNom: stage.classeNom,
      statut: stage.statut,
      entrepriseNom: stage.entrepriseNom,
      entrepriseAdresse: stage.entrepriseAdresse,
      entrepriseTelephone: stage.entrepriseTelephone,
      entrepriseEmail: stage.entrepriseEmail,
      tuteurNomQualite: stage.tuteurNomQualite,
      tuteurEmail: stage.tuteurEmail,
      tuteurTelephone: stage.tuteurTelephone,
      dateDebut: stage.dateDebut,
      dateFin: stage.dateFin,
      professeurReferent:
        stage.professeurReferentNom && stage.professeurReferentPrenom
          ? `${stage.professeurReferentNom} ${stage.professeurReferentPrenom}`
          : null,
    },
    livret,
    canEditEleve,
    canEditSuivi,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "PUT") {
    return methodNotAllowed(res, ["GET", "PUT"]);
  }

  await handleApi(res, async () => {
    const user = await requireUser(req);
    const eleveId = await resolveEleveId(req, user);
    const stage = await loadStage(eleveId);
    if (!stage) throw new HttpError(404, "Stage introuvable");
    if (!isStageModuleActive(stage.classeNiveau, stage.statut)) {
      throw new HttpError(404, "Stage desactive pour cet eleve");
    }

    const professeurId = await getProfesseurIdForUser(user);
    const ownEleve = stage.eleveAuthUserId === user.id;
    const staffCanRead =
      user.role !== "eleve" && canReadStageForUser(stage, user, professeurId);
    if (!ownEleve && !staffCanRead) {
      throw new HttpError(403, "Acces interdit au livret de stage");
    }

    const canEditEleve =
      ownEleve ||
      isGlobalStaff(user.role) ||
      stage.professeurPrincipalId === user.id;
    const canEditSuivi =
      isGlobalStaff(user.role) ||
      stage.professeurPrincipalId === user.id ||
      stage.professeurReferentId === user.id ||
      Boolean(professeurId && stage.professeurReferentId === professeurId);

    const currentLivret = parseLivret(
      stage.notesSuivi,
      stage.dateVisite,
      stage.compteRenduVisite
    );

    if (req.method === "GET") {
      return formatResponse(stage, currentLivret, canEditEleve, canEditSuivi);
    }

    if (!canEditEleve && !canEditSuivi) {
      throw new HttpError(403, "Modification du livret interdite");
    }

    const body = (req.body ?? {}) as { livret?: unknown; submitEleve?: boolean };
    let nextLivret = currentLivret;
    if (canEditEleve) {
      nextLivret = mergeEleveFields(nextLivret, body.livret);
      if (body.submitEleve === true) {
        nextLivret.soumisEleveAt = new Date().toISOString();
      }
    }
    if (canEditSuivi) {
      nextLivret = mergeSuiviFields(nextLivret, body.livret);
    }

    await db
      .update(stages)
      .set({
        notesSuivi: JSON.stringify(nextLivret),
        dateVisite: nextLivret.suiviProf.dateVisite || null,
        compteRenduVisite: nextLivret.suiviProf.observations || null,
        updatedAt: new Date(),
      })
      .where(eq(stages.id, stage.id));

    const updatedStage = await loadStage(eleveId);
    if (!updatedStage) throw new HttpError(404, "Stage introuvable");

    return formatResponse(updatedStage, nextLivret, canEditEleve, canEditSuivi);
  });
}
