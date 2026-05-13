import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  date,
  serial,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";

export const etablissement = pgTable("etablissement", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull().default("Lycée Blaise Cendrars"),
  adresse: text("adresse").notNull().default("12 avenue Léon Jouhaux"),
  codePostal: text("code_postal").notNull().default("93270"),
  ville: text("ville").notNull().default("Sevran"),
  telephone: text("telephone").default("01 49 36 20 50"),
  email: text("email").default("Ce.0932048w@ac-creteil.fr"),
  uai: text("uai").default("0932048W"),
  nomProviseur: text("nom_proviseur").notNull().default("VER-EECKE"),
  civiliteProviseur: text("civilite_proviseur").default("Mme"),
  logoUrl: text("logo_url"),
  cachetUrl: text("cachet_url"),
  anneeScolaire: text("annee_scolaire").default("2025-2026"),
  dateStageDebut: date("date_stage_debut").default("2026-06-15"),
  dateStageFin: date("date_stage_fin").default("2026-06-26"),
  dateLimiteConvention: date("date_limite_convention").default("2026-06-01"),
  dateGoDebut: date("date_go_debut").default("2026-06-22"),
  dateGoFin: date("date_go_fin").default("2026-07-01"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  niveau: text("niveau").notNull(),
  anneeScolaire: text("annee_scolaire").notNull().default("2025-2026"),
  professeurPrincipalId: text("professeur_principal_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const professeurs = pgTable("professeurs", {
  id: serial("id").primaryKey(),
  identityId: text("identity_id").unique(),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  email: text("email").notNull().unique(),
  matieres: text("matieres"),
  role: text("role").notNull().default("professeur"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eleves = pgTable("eleves", {
  id: serial("id").primaryKey(),
  identityId: text("identity_id").unique(),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  classeId: integer("classe_id").references(() => classes.id),
  emailEleve: text("email_eleve"),
  emailFamille: text("email_famille"),
  telephoneFamille: text("telephone_famille"),
  dateNaissance: date("date_naissance"),
  numeroCanditat: text("numero_candidat"),
  codeAcces: text("code_acces").unique(),
  anneeScolaire: text("annee_scolaire").notNull().default("2025-2026"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const stages = pgTable("stages", {
  id: serial("id").primaryKey(),
  eleveId: integer("eleve_id")
    .notNull()
    .references(() => eleves.id),
  numeroConvention: integer("numero_convention").default(1),
  statut: text("statut").notNull().default("a_completer"),

  entrepriseNom: text("entreprise_nom"),
  entrepriseRepresentant: text("entreprise_representant"),
  entrepriseQualite: text("entreprise_qualite"),
  entrepriseAdresse: text("entreprise_adresse"),
  entrepriseTelephone: text("entreprise_telephone"),
  entrepriseEmail: text("entreprise_email"),
  entrepriseType: text("entreprise_type"),

  tuteurNomQualite: text("tuteur_nom_qualite"),
  tuteurEmail: text("tuteur_email"),
  tuteurTelephone: text("tuteur_telephone"),

  horaireLundiMatinDebut: text("horaire_lundi_matin_debut"),
  horaireLundiMatinFin: text("horaire_lundi_matin_fin"),
  horaireLundiApmDebut: text("horaire_lundi_apm_debut"),
  horaireLundiApmFin: text("horaire_lundi_apm_fin"),
  horaireMardiMatinDebut: text("horaire_mardi_matin_debut"),
  horaireMardiMatinFin: text("horaire_mardi_matin_fin"),
  horaireMardiApmDebut: text("horaire_mardi_apm_debut"),
  horaireMardiApmFin: text("horaire_mardi_apm_fin"),
  horaireMercrediMatinDebut: text("horaire_mercredi_matin_debut"),
  horaireMercrediMatinFin: text("horaire_mercredi_matin_fin"),
  horaireMercrediApmDebut: text("horaire_mercredi_apm_debut"),
  horaireMercrediApmFin: text("horaire_mercredi_apm_fin"),
  horaireJeudiMatinDebut: text("horaire_jeudi_matin_debut"),
  horaireJeudiMatinFin: text("horaire_jeudi_matin_fin"),
  horaireJeudiApmDebut: text("horaire_jeudi_apm_debut"),
  horaireJeudiApmFin: text("horaire_jeudi_apm_fin"),
  horaireVendrediMatinDebut: text("horaire_vendredi_matin_debut"),
  horaireVendrediMatinFin: text("horaire_vendredi_matin_fin"),
  horaireVendrediApmDebut: text("horaire_vendredi_apm_debut"),
  horaireVendrediApmFin: text("horaire_vendredi_apm_fin"),

  dateDebut: date("date_debut").default("2026-06-15"),
  dateFin: date("date_fin").default("2026-06-26"),
  faitLe: date("fait_le"),

  professeurReferentId: integer("professeur_referent_id").references(
    () => professeurs.id
  ),

  conventionPdfUrl: text("convention_pdf_url"),
  conventionGenereeAt: timestamp("convention_generee_at"),

  notesSuivi: text("notes_suivi"),
  dateVisite: date("date_visite"),
  compteRenduVisite: text("compte_rendu_visite"),

  soumisAt: timestamp("soumis_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fichesGrandOral = pgTable("fiches_grand_oral", {
  id: serial("id").primaryKey(),
  eleveId: integer("eleve_id")
    .notNull()
    .references(() => eleves.id),
  anneeScolaire: text("annee_scolaire").notNull().default("2025-2026"),

  numeroCanditat: text("numero_candidat"),
  question1: text("question_1"),
  specialitesQuestion1: text("specialites_question_1"),
  question2: text("question_2"),
  specialitesQuestion2: text("specialites_question_2"),

  statut: text("statut").notNull().default("brouillon"),

  signatureEleveUrl: text("signature_eleve_url"),
  signeEleveAt: timestamp("signe_eleve_at"),

  profSpe1Id: integer("prof_spe1_id").references(() => professeurs.id),
  commentaireProf1: text("commentaire_prof1"),
  signatureProf1Url: text("signature_prof1_url"),
  signeProf1At: timestamp("signe_prof1_at"),

  profSpe2Id: integer("prof_spe2_id").references(() => professeurs.id),
  commentaireProf2: text("commentaire_prof2"),
  signatureProf2Url: text("signature_prof2_url"),
  signeProf2At: timestamp("signe_prof2_at"),

  signatureProviseurUrl: text("signature_proviseur_url"),
  cachetApposeAt: timestamp("cachet_appose_at"),

  fichePdfUrl: text("fiche_pdf_url"),
  pdfGenereAt: timestamp("pdf_genere_at"),

  soumisAt: timestamp("soumis_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const importLogs = pgTable("import_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  fichierNom: text("fichier_nom"),
  nbImportes: integer("nb_importes").default(0),
  nbDoublons: integer("nb_doublons").default(0),
  nbErreurs: integer("nb_erreurs").default(0),
  detailErreurs: jsonb("detail_erreurs"),
  importePar: text("importe_par"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationsLog = pgTable("notifications_log", {
  id: serial("id").primaryKey(),
  destinataireEmail: text("destinataire_email").notNull(),
  typeNotif: text("type_notif").notNull(),
  module: text("module").notNull(),
  referenceId: integer("reference_id"),
  envoiOk: boolean("envoi_ok").default(false),
  erreurMessage: text("erreur_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const templatesDocuments = pgTable("templates_documents", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().unique(),
  nom: text("nom").notNull(),
  contenuJson: jsonb("contenu_json").notNull(),
  version: integer("version").notNull().default(1),
  actif: boolean("actif").default(true),
  modifiePar: text("modifie_par"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
