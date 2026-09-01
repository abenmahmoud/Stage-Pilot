import type { AgentIdentityLevel } from "./agent-identity-policy.js";

export type SchoolService =
  | "referent_numerique"
  | "ddfpt"
  | "secretariat"
  | "vie_scolaire"
  | "intendance"
  | "direction"
  | "administration";

export type RoutingConfidence = "high" | "medium" | "low";
export type SupportPriority = "p1" | "p2" | "p3" | "p4";
export type SupportRoute = {
  service: SchoolService;
  confidence: RoutingConfidence;
  reason: string;
  requiredIdentity: AgentIdentityLevel;
  priority: SupportPriority;
};

export function initialSupportStatus(confidence: RoutingConfidence): "nouveau" | "a_qualifier" {
  return confidence === "low" ? "a_qualifier" : "nouveau";
}

const CATEGORY_SERVICES: Record<string, SchoolService> = {
  inscription: "secretariat",
  affectation_classe: "secretariat",
  documents_scolarite: "secretariat",
  ent: "referent_numerique",
  email_academique: "referent_numerique",
  ordinateur: "referent_numerique",
  logiciel: "referent_numerique",
  restauration_bourse: "intendance",
  orientation_formation: "secretariat",
  vie_scolaire: "vie_scolaire",
  autre: "administration",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function requiredIdentity(category: string, text: string): AgentIdentityLevel {
  if (
    ["ent", "email_academique"].includes(category) ||
    /\b(code|identifiant|mot de passe|compte academique|educonnect)\b/.test(text)
  ) {
    return "I3";
  }
  if (
    category === "affectation_classe" ||
    category === "vie_scolaire" ||
    /\b(mon emploi du temps|ma salle|mon cours|mon prochain cours|quelle salle|salle.{0,20}cours|cours (annule|deplace|maintenu)|professeur absent|justificatif|absence)\b/.test(text)
  ) {
    return "I3";
  }
  if (["documents_scolarite", "inscription", "restauration_bourse"].includes(category)) {
    return "I2";
  }
  return "I0";
}

export function routeSupportRequest(input: {
  category: string;
  subject?: string;
  description: string;
}): SupportRoute {
  const text = normalize(`${input.subject ?? ""}\n${input.description}`);
  const identity = requiredIdentity(input.category, text);

  if (
    /\b(harcelement|violence|danger|menace|discrimination|decrochage|mal etre|suicide)\b/.test(text)
  ) {
    return {
      service: "vie_scolaire",
      confidence: "high",
      reason: "protection_ou_vie_scolaire",
      requiredIdentity: "I0",
      priority: "p1",
    };
  }
  if (
    /\b(ent|educonnect|webmail|zimbra|email academique|wifi|reseau|ordinateur|pc|tablette|logiciel|connexion)\b/.test(text)
  ) {
    return {
      service: "referent_numerique",
      confidence: "high",
      reason: "acces_ou_equipement_numerique",
      requiredIdentity: identity,
      priority: "p3",
    };
  }
  if (
    /\b((professeur|enseignant).{0,16}absent|mon prochain cours|ma salle|changement de salle|cours (annule|deplace|maintenu)|emploi du temps|absence|retard|justificatif|cpe|vie scolaire|surveillant|aed|sanction)\b/.test(text)
  ) {
    return {
      service: "vie_scolaire",
      confidence: "high",
      reason: "absence_ou_vie_scolaire",
      requiredIdentity: identity,
      priority: "p3",
    };
  }
  if (
    /\b(ddfpt|pfmp|periode de formation|convention de stage|recherche de stage|entreprise d'accueil|mini[- ]stage|plateau technique|atelier professionnel|voie professionnelle|formation professionnelle|melec|pcepc)\b/.test(text)
  ) {
    return {
      service: "ddfpt",
      confidence: "high",
      reason: "formation_professionnelle_ou_stage",
      requiredIdentity: identity,
      priority: "p3",
    };
  }
  if (/\b(cantine|restauration|bourse|intendance|demi-pension|paiement)\b/.test(text)) {
    return {
      service: "intendance",
      confidence: "high",
      reason: "intendance_ou_aide_financiere",
      requiredIdentity: identity,
      priority: "p3",
    };
  }
  if (
    /\b(inscription|reinscription|certificat|attestation|dossier|piece manquante|affectation|classe|orientation|parcoursup)\b/.test(text)
  ) {
    return {
      service: "secretariat",
      confidence: "high",
      reason: "scolarite_ou_dossier_administratif",
      requiredIdentity: identity,
      priority: "p3",
    };
  }
  if (/\b(direction|proviseur|partenariat|reclamation|incident grave)\b/.test(text)) {
    return {
      service: "direction",
      confidence: "medium",
      reason: "direction_ou_situation_transverse",
      requiredIdentity: identity,
      priority: /\bincident grave\b/.test(text) ? "p2" : "p3",
    };
  }
  if (
    /\b(rendez[- ]?vous|rdv|prendre rendez[- ]?vous|etre recu|rencontrer (le|la|un|une) (secretariat|administration|cpe|proviseur))\b/.test(text)
  ) {
    return {
      service: "administration",
      confidence: "medium",
      reason: "rendez_vous_a_qualifier",
      requiredIdentity: identity,
      priority: "p3",
    };
  }

  const categoryService = CATEGORY_SERVICES[input.category];
  return {
    service: categoryService ?? "administration",
    confidence: categoryService && input.category !== "autre" ? "medium" : "low",
    reason: categoryService && input.category !== "autre" ? "categorie_declaree" : "qualification_humaine_requise",
    requiredIdentity: identity,
    priority: "p3",
  };
}
