export type UserRole =
  | "superadmin"
  | "administration"
  | "pp"
  | "professeur"
  | "proviseur"
  | "eleve";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  metadata?: Record<string, unknown>;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: "Super Admin",
  administration: "Administration",
  pp: "Professeur Principal",
  professeur: "Professeur",
  proviseur: "Proviseur",
  eleve: "Élève",
};

export const ROLE_HOME: Record<UserRole, string> = {
  superadmin: "/admin",
  administration: "/stages",
  pp: "/stages",
  professeur: "/stages",
  proviseur: "/grand-oral",
  eleve: "/stages/mon-stage",
};

export const STAGE_STATUS = {
  a_completer: { label: "Rien saisi", color: "bg-red-100 text-red-700" },
  en_cours_saisie: {
    label: "En cours",
    color: "bg-yellow-100 text-yellow-700",
  },
  soumis: { label: "Soumis", color: "bg-blue-100 text-blue-700" },
  convention_generee: {
    label: "PDF prêt",
    color: "bg-indigo-100 text-indigo-700",
  },
  convention_signee: {
    label: "Dossier complet",
    color: "bg-green-100 text-green-700",
  },
  stage_en_cours: {
    label: "Stage en cours",
    color: "bg-emerald-100 text-emerald-700",
  },
  stage_termine: {
    label: "Stage terminé",
    color: "bg-emerald-100 text-emerald-800",
  },
  dispense: { label: "Dispensé", color: "bg-gray-100 text-gray-600" },
  accueil_lycee: {
    label: "Accueil lycée",
    color: "bg-purple-100 text-purple-700",
  },
} as const;

export const GO_STATUS = {
  brouillon: { label: "Brouillon", color: "bg-gray-100 text-gray-600" },
  soumis_prof1: {
    label: "Attente prof spé 1",
    color: "bg-yellow-100 text-yellow-700",
  },
  valide_prof1: { label: "Prof spé 1 ✓", color: "bg-blue-100 text-blue-700" },
  soumis_prof2: {
    label: "Attente prof spé 2",
    color: "bg-yellow-100 text-yellow-700",
  },
  valide_prof2: {
    label: "Prof spé 2 ✓",
    color: "bg-indigo-100 text-indigo-700",
  },
  soumis_proviseur: {
    label: "Attente cachet",
    color: "bg-orange-100 text-orange-700",
  },
  valide_proviseur: {
    label: "Cachet apposé",
    color: "bg-teal-100 text-teal-700",
  },
  finalise: { label: "PDF disponible", color: "bg-green-100 text-green-700" },
} as const;

export type StageStatut = keyof typeof STAGE_STATUS;
export type GOStatut = keyof typeof GO_STATUS;

export const SPECIALITES = [
  "Arts",
  "HGGSP",
  "HLP",
  "LLCE",
  "Mathématiques",
  "NSI",
  "Physique-Chimie",
  "SVT",
  "SES",
  "Sciences de l'ingénieur",
  "STMG — Mercatique",
  "STMG — RHC",
  "STMG — Gestion-Finance",
  "STMG — SIG",
  "STI2D",
  "ST2S",
  "STL",
  "STD2A",
  "STHR",
  "TMD",
  "STAV",
];

export const ENTREPRISE_TYPES = [
  "Entreprise privée",
  "Administration publique",
  "Association",
  "Collectivité territoriale",
  "Établissement de santé",
  "Autre",
];
