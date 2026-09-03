// Jeu d'essai entierement fictif pour le parcours d'envois nominatifs.
//
// Toutes les personnes ci-dessous sont inventees. Aucun lien avec un eleve, un
// parent ou un personnel reel. Ce module existe pour que le parcours complet
// puisse etre parcouru, montre et prouve sans jamais toucher un fichier reel.
//
// La copie CSV est identique au fichier
// `scripts/fixtures/cantine-fictif/cantine-2026-2027-fictif.csv`, et un test
// verifie que les deux ne divergent pas.

import type { DirectoryBeneficiary } from "./nominative-import.js";

export const FICTITIOUS_CANTINE_SCHOOL_YEAR = "2026-2027";
export const FICTITIOUS_CANTINE_SOURCE_REF = "import:cantine:fictif01";

export const FICTITIOUS_CANTINE_CSV = [
  "Reference eleve;Nom;Prenom;Classe;Numero de badge",
  "eleve:fictif01;Martin;Alice;2nde 4;0042",
  "eleve:fictif02;Martin;Bruno;2nde 4;0043",
  ";Nguyen;Camille;1ere 2;0100",
  ";Nguyen;Camille;1ere 2;0101",
  "eleve:fictif05;Dubois;Elias;Tale 1;",
  "eleve:fictif06;Dubois;Farah;Tale 1;0210",
  "eleve:fictif07;Lopez;Gabriel;2nde 4;0311",
  "eleve:fictif01;Martin;Alice;2nde 4;0042",
  "eleve:fictif09;Inconnu;Hugo;2nde 9;0400",
  "",
].join("\n");

export const FICTITIOUS_CANTINE_DIRECTORY: readonly DirectoryBeneficiary[] = [
  { beneficiaryRef: "eleve:fictif01", lastName: "Martin", firstName: "Alice", classLabel: "2nde 4", contactRef: "contact:parent0001", contactRevoked: false },
  { beneficiaryRef: "eleve:fictif02", lastName: "Martin", firstName: "Bruno", classLabel: "2nde 4", contactRef: "contact:parent0001", contactRevoked: false },
  { beneficiaryRef: "eleve:fictif03", lastName: "Nguyen", firstName: "Camille", classLabel: "1ere 2", contactRef: "contact:parent0003", contactRevoked: false },
  { beneficiaryRef: "eleve:fictif04", lastName: "Nguyen", firstName: "Camille", classLabel: "1ere 2", contactRef: "contact:parent0004", contactRevoked: false },
  { beneficiaryRef: "eleve:fictif05", lastName: "Dubois", firstName: "Elias", classLabel: "Tale 1", contactRef: "contact:parent0005", contactRevoked: false },
  { beneficiaryRef: "eleve:fictif06", lastName: "Dubois", firstName: "Farah", classLabel: "Tale 1", contactRef: null, contactRevoked: false },
  { beneficiaryRef: "eleve:fictif07", lastName: "Lopez", firstName: "Gabriel", classLabel: "2nde 4", contactRef: "contact:parent0007", contactRevoked: true },
];

export const FICTITIOUS_CANTINE_TEMPLATE = {
  templateRef: "modele:cantine:v1",
  subject: "Cantine — {{beneficiaire_prenom}} {{beneficiaire_nom}}",
  preheader: "Information de cantine pour l’année {{annee_scolaire}}",
  bodyText: [
    "Bonjour,",
    "",
    "Voici l’information de cantine de {{beneficiaire_prenom}} {{beneficiaire_nom}} ({{beneficiaire_classe}})",
    "pour l’année scolaire {{annee_scolaire}} :",
    "",
    "{{valeur}}",
    "",
    "Cette information est personnelle : elle ne concerne que cet élève.",
    "",
    "Le lycée Blaise Cendrars.",
  ].join("\n"),
} as const;

/** Libelle lisible d'un bénéficiaire fictif, pour l'écran de vérification. */
export function fictitiousBeneficiaryLabel(beneficiaryRef: string): string {
  const person = FICTITIOUS_CANTINE_DIRECTORY.find((item) => item.beneficiaryRef === beneficiaryRef);
  return person ? person.firstName + " " + person.lastName + " (" + person.classLabel + ")" : beneficiaryRef;
}
