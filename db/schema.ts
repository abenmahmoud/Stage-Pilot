import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  date,
  jsonb,
  uuid,
  bigint,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Établissement scolaire — une seule ligne par déploiement.
 */
export const etablissement = pgTable("etablissement", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Classes (2nde, 1ère, terminale).
 * `professeur_principal_id` pointe vers auth.users (UUID) via app_metadata.role='pp'.
 */
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nom: text("nom").notNull(),
  niveau: text("niveau").notNull(),
  anneeScolaire: text("annee_scolaire").notNull().default("2025-2026"),
  professeurPrincipalId: uuid("professeur_principal_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Professeurs — fiche métier reliée optionnellement à un compte auth.
 * `auth_user_id` est nullable car certains profs peuvent ne pas avoir de compte
 * (référent invité, prof démissionnaire, etc.).
 */
export const professeurs = pgTable("professeurs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  authUserId: uuid("auth_user_id").unique(),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  email: text("email").unique(),
  matieres: text("matieres"),
  codeAcces: text("code_acces").unique(),
  role: text("role").notNull().default("professeur"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Élèves — fiche métier reliée optionnellement à un compte auth.
 */
export const eleves = pgTable("eleves", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  authUserId: uuid("auth_user_id").unique(),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  classeId: uuid("classe_id").references(() => classes.id),
  emailEleve: text("email_eleve"),
  emailFamille: text("email_famille"),
  telephoneFamille: text("telephone_famille"),
  dateNaissance: date("date_naissance"),
  numeroCanditat: text("numero_candidat"),
  codeAcces: text("code_acces").unique(),
  anneeScolaire: text("annee_scolaire").notNull().default("2025-2026"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Stages — un par élève par année.
 */
export const stages = pgTable("stages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eleveId: uuid("eleve_id")
    .notNull()
    .references(() => eleves.id, { onDelete: "cascade" }),
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

  professeurReferentId: uuid("professeur_referent_id").references(
    () => professeurs.id
  ),

  conventionPdfUrl: text("convention_pdf_url"),
  conventionGenereeAt: timestamp("convention_generee_at", { withTimezone: true }),

  notesSuivi: text("notes_suivi"),
  dateVisite: date("date_visite"),
  compteRenduVisite: text("compte_rendu_visite"),

  soumisAt: timestamp("soumis_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Fiche Grand Oral — une par élève de terminale.
 */
export const fichesGrandOral = pgTable("fiches_grand_oral", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eleveId: uuid("eleve_id")
    .notNull()
    .references(() => eleves.id, { onDelete: "cascade" }),
  anneeScolaire: text("annee_scolaire").notNull().default("2025-2026"),

  numeroCanditat: text("numero_candidat"),
  question1: text("question_1"),
  specialitesQuestion1: text("specialites_question_1"),
  question2: text("question_2"),
  specialitesQuestion2: text("specialites_question_2"),

  statut: text("statut").notNull().default("brouillon"),

  signatureEleveUrl: text("signature_eleve_url"),
  signeEleveAt: timestamp("signe_eleve_at", { withTimezone: true }),

  profSpe1Id: uuid("prof_spe1_id").references(() => professeurs.id),
  commentaireProf1: text("commentaire_prof1"),
  signatureProf1Url: text("signature_prof1_url"),
  signeProf1At: timestamp("signe_prof1_at", { withTimezone: true }),

  profSpe2Id: uuid("prof_spe2_id").references(() => professeurs.id),
  commentaireProf2: text("commentaire_prof2"),
  signatureProf2Url: text("signature_prof2_url"),
  signeProf2At: timestamp("signe_prof2_at", { withTimezone: true }),

  signatureProviseurUrl: text("signature_proviseur_url"),
  cachetApposeAt: timestamp("cachet_appose_at", { withTimezone: true }),

  fichePdfUrl: text("fiche_pdf_url"),
  pdfGenereAt: timestamp("pdf_genere_at", { withTimezone: true }),

  soumisAt: timestamp("soumis_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Journal des imports CSV.
 */
export const importLogs = pgTable("import_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  fichierNom: text("fichier_nom"),
  nbImportes: integer("nb_importes").default(0),
  nbDoublons: integer("nb_doublons").default(0),
  nbErreurs: integer("nb_erreurs").default(0),
  detailErreurs: jsonb("detail_erreurs"),
  importePar: text("importe_par"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Journal des notifications email.
 */
export const notificationsLog = pgTable("notifications_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  destinataireEmail: text("destinataire_email").notNull(),
  typeNotif: text("type_notif").notNull(),
  module: text("module").notNull(),
  referenceId: uuid("reference_id"),
  envoiOk: boolean("envoi_ok").default(false),
  erreurMessage: text("erreur_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Templates d'emails et de documents (PDF, etc.) éditables côté admin.
 */
export const templatesDocuments = pgTable("templates_documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull().unique(),
  nom: text("nom").notNull(),
  contenuJson: jsonb("contenu_json").notNull(),
  version: integer("version").notNull().default(1),
  actif: boolean("actif").default(true),
  modifiePar: text("modifie_par"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const institutions = pgTable("institutions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Europe/Paris"),
  settings: jsonb("settings").notNull().default({}),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const institutionMemberships = pgTable(
  "institution_memberships",
  {
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(),
    serviceCodes: text("service_codes")
      .array()
      .notNull()
      .default(sql`array[]::text[]`),
    mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }),
    status: text("status").notNull().default("invited"),
    grantedBy: uuid("granted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "institution_memberships_pkey",
      columns: [table.institutionId, table.userId],
    }),
    index("institution_memberships_user_status_idx").on(table.userId, table.status),
    index("institution_memberships_service_codes_idx").using("gin", table.serviceCodes),
  ]
);

export const identityDirectoryImports = pgTable(
  "identity_directory_imports",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    purposeDescription: text("purpose_description").notNull(),
    sourceType: text("source_type").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    storageBucket: text("storage_bucket").notNull().default("identity-ingest"),
    storagePath: text("storage_path").notNull().unique(),
    checksum: text("checksum"),
    status: text("status").notNull().default("reserved"),
    rowCount: integer("row_count"),
    validRowCount: integer("valid_row_count"),
    rejectedRowCount: integer("rejected_row_count"),
    validationSummary: jsonb("validation_summary").notNull().default({}),
    uploadedBy: uuid("uploaded_by").notNull(),
    approvedBy: uuid("approved_by"),
    retiredBy: uuid("retired_by"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    retirementReason: text("retirement_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("identity_directory_imports_status_idx").on(
      table.institutionId,
      table.status,
      table.createdAt
    ),
    index("identity_directory_imports_uploaded_by_idx").on(table.uploadedBy),
    index("identity_directory_imports_approved_by_idx")
      .on(table.approvedBy)
      .where(sql`${table.approvedBy} is not null`),
    index("identity_directory_imports_retired_by_idx")
      .on(table.retiredBy)
      .where(sql`${table.retiredBy} is not null`),
  ]
);

export const identityDirectoryRows = pgTable(
  "identity_directory_rows",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    importId: uuid("import_id")
      .notNull()
      .references(() => identityDirectoryImports.id, { onDelete: "cascade" }),
    sourceSheet: text("source_sheet").notNull(),
    rowNumber: integer("row_number").notNull(),
    recordType: text("record_type").notNull(),
    personRef: text("person_ref"),
    personType: text("person_type"),
    subjectPersonRef: text("subject_person_ref"),
    relationshipType: text("relationship_type"),
    objectRef: text("object_ref"),
    classRef: text("class_ref"),
    serviceCode: text("service_code"),
    academicEmailHash: text("academic_email_hash"),
    personalEmailHash: text("personal_email_hash"),
    phoneHash: text("phone_hash"),
    validFrom: date("valid_from"),
    validUntil: date("valid_until"),
    validationStatus: text("validation_status").notNull(),
    issues: jsonb("issues").notNull().default([]),
    fingerprint: text("fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("identity_directory_rows_import_status_idx").on(
      table.importId,
      table.validationStatus,
      table.rowNumber
    ),
    index("identity_directory_rows_person_ref_idx").on(
      table.institutionId,
      table.personRef
    ),
    index("identity_directory_rows_subject_ref_idx").on(
      table.institutionId,
      table.subjectPersonRef
    ),
    index("identity_directory_rows_import_institution_idx").on(
      table.importId,
      table.institutionId
    ),
  ]
);

export const contactVerifications = pgTable(
  "contact_verifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    supportSessionId: uuid("support_session_id"),
    channel: text("channel").notNull(),
    contactHash: text("contact_hash").notNull(),
    purpose: text("purpose").notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("contact_verifications_subject_idx").on(
      table.institutionId,
      table.userId,
      table.supportSessionId,
      table.status
    ),
  ]
);

export const schoolIdentities = pgTable(
  "school_identities",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    sourceImportId: uuid("source_import_id")
      .notNull()
      .references(() => identityDirectoryImports.id, { onDelete: "restrict" }),
    personType: text("person_type").notNull(),
    officialPersonRef: text("official_person_ref").notNull(),
    assuranceLevel: text("assurance_level").notNull(),
    verifiedBy: uuid("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    evidence: jsonb("evidence").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("school_identities_user_idx").on(
      table.institutionId,
      table.userId,
      table.personType
    ),
    index("school_identities_official_ref_idx").on(
      table.institutionId,
      table.officialPersonRef,
      table.personType
    ),
  ]
);

export const schoolRelationships = pgTable(
  "school_relationships",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    subjectIdentityId: uuid("subject_identity_id")
      .notNull()
      .references(() => schoolIdentities.id, { onDelete: "cascade" }),
    objectPersonRef: text("object_person_ref").notNull(),
    relationshipType: text("relationship_type").notNull(),
    validFrom: date("valid_from").notNull(),
    validUntil: date("valid_until"),
    sourceImportId: uuid("source_import_id")
      .notNull()
      .references(() => identityDirectoryImports.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("school_relationships_subject_active_idx").on(
      table.institutionId,
      table.subjectIdentityId,
      table.status,
      table.validUntil
    ),
    index("school_relationships_object_active_idx").on(
      table.institutionId,
      table.objectPersonRef,
      table.status,
      table.validUntil
    ),
  ]
);

export const identityDirectoryAudit = pgTable(
  "identity_directory_audit",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    action: text("action").notNull(),
    actorId: uuid("actor_id"),
    summary: jsonb("summary").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("identity_directory_audit_resource_idx").on(
      table.resourceType,
      table.resourceId,
      table.createdAt
    ),
    index("identity_directory_audit_institution_idx").on(
      table.institutionId,
      table.createdAt
    ),
  ]
);

export const knowledgeSources = pgTable(
  "knowledge_sources",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sourceType: text("source_type").notNull(),
    uri: text("uri").notNull(),
    classification: text("classification").notNull().default("internal"),
    ownerUserId: uuid("owner_user_id").notNull(),
    serviceCodes: text("service_codes")
      .array()
      .notNull()
      .default(sql`array[]::text[]`),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    status: text("status").notNull().default("draft"),
    checksum: text("checksum").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("knowledge_sources_institution_status_idx").on(
      table.institutionId,
      table.status
    ),
    index("knowledge_sources_expiry_idx").on(table.expiresAt),
    index("knowledge_sources_service_codes_idx").using("gin", table.serviceCodes),
  ]
);

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => knowledgeSources.id, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    purposeDescription: text("purpose_description").notNull(),
    sourceType: text("source_type").notNull(),
    classification: text("classification").notNull().default("internal"),
    ownerServiceCode: text("owner_service_code").notNull(),
    serviceCodes: text("service_codes")
      .array()
      .notNull()
      .default(sql`array[]::text[]`),
    validFrom: date("valid_from").notNull(),
    reviewDueAt: timestamp("review_due_at", { withTimezone: true }).notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    storageBucket: text("storage_bucket").notNull().default("knowledge-ingest"),
    storagePath: text("storage_path").notNull().unique(),
    status: text("status").notNull().default("reserved"),
    checksum: text("checksum"),
    analysisSummary: text("analysis_summary"),
    proposedKnowledge: jsonb("proposed_knowledge").notNull().default({}),
    analysisError: text("analysis_error"),
    uploadedBy: uuid("uploaded_by").notNull(),
    reviewedBy: uuid("reviewed_by"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("knowledge_documents_institution_status_idx").on(
      table.institutionId,
      table.status,
      table.createdAt
    ),
    index("knowledge_documents_service_codes_idx").using("gin", table.serviceCodes),
    index("knowledge_documents_owner_review_idx").on(
      table.institutionId,
      table.ownerServiceCode,
      table.reviewDueAt
    ),
  ]
);

export const agentSkills = pgTable(
  "agent_skills",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    skillKey: text("skill_key").notNull(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    activeVersionId: uuid("active_version_id"),
    enabled: boolean("enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("agent_skills_institution_key_uidx").on(
      table.institutionId,
      table.skillKey
    ),
    index("agent_skills_institution_enabled_idx").on(
      table.institutionId,
      table.enabled
    ),
  ]
);

export const agentSkillVersions = pgTable(
  "agent_skill_versions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => agentSkills.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    status: text("status").notNull().default("draft"),
    definition: jsonb("definition").notNull().default({}),
    contentHash: text("content_hash").notNull(),
    dataClassification: text("data_classification").notNull().default("internal"),
    createdBy: uuid("created_by").notNull(),
    approvedBy: uuid("approved_by"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    reviewDueAt: timestamp("review_due_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("agent_skill_versions_skill_version_uidx").on(
      table.skillId,
      table.version
    ),
    index("agent_skill_versions_status_review_idx").on(
      table.institutionId,
      table.status,
      table.reviewDueAt
    ),
  ]
);

export const skillSourceLinks = pgTable(
  "skill_source_links",
  {
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    skillVersionId: uuid("skill_version_id")
      .notNull()
      .references(() => agentSkillVersions.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: "restrict" }),
    required: boolean("required").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "skill_source_links_pkey",
      columns: [table.skillVersionId, table.sourceId],
    }),
    index("skill_source_links_source_idx").on(table.sourceId),
  ]
);

export const agentEvaluations = pgTable(
  "agent_evaluations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    skillVersionId: uuid("skill_version_id")
      .notNull()
      .references(() => agentSkillVersions.id, { onDelete: "cascade" }),
    testCaseKey: text("test_case_key").notNull(),
    kind: text("kind").notNull(),
    result: text("result").notNull(),
    scores: jsonb("scores").notNull().default({}),
    evidence: jsonb("evidence").notNull().default({}),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("agent_evaluations_version_case_uidx").on(
      table.skillVersionId,
      table.testCaseKey
    ),
    index("agent_evaluations_institution_run_idx").on(
      table.institutionId,
      table.runAt
    ),
  ]
);

export const agentSkillAudit = pgTable(
  "agent_skill_audit",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    action: text("action").notNull(),
    actorId: uuid("actor_id"),
    summary: jsonb("summary").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("agent_skill_audit_resource_idx").on(
      table.resourceType,
      table.resourceId,
      table.createdAt
    ),
    index("agent_skill_audit_institution_created_idx").on(
      table.institutionId,
      table.createdAt
    ),
  ]
);

export const siteContentTemplates = pgTable("site_content_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  description: text("description").notNull().default(""),
  defaultTitle: text("default_title").notNull().default(""),
  defaultSummary: text("default_summary").notNull().default(""),
  defaultBodyMarkdown: text("default_body_markdown").notNull().default(""),
  active: boolean("active").notNull().default(true),
  version: integer("version").notNull().default(1),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteContentItems = pgTable("site_content_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contentType: text("content_type").notNull(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  bodyMarkdown: text("body_markdown").notNull().default(""),
  category: text("category").notNull().default("Vie du lycée"),
  audience: text("audience").notNull().default("tous"),
  status: text("status").notNull().default("brouillon"),
  templateId: uuid("template_id").references(() => siteContentTemplates.id, { onDelete: "set null" }),
  featured: boolean("featured").notNull().default(false),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  sourceSystem: text("source_system"),
  sourceUrl: text("source_url"),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
  importKey: text("import_key"),
  sourceDisposition: text("source_disposition"),
  needsReview: boolean("needs_review").notNull().default(false),
  importedAt: timestamp("imported_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by"),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  approvedBy: uuid("approved_by"),
  version: integer("version").notNull().default(1),
  publishedVersion: integer("published_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteContentVersions = pgTable("site_content_versions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contentId: uuid("content_id").notNull().references(() => siteContentItems.id, { onDelete: "restrict" }),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteContentAssets = pgTable("site_content_assets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  storageBucket: text("storage_bucket").notNull().default("site-content"),
  storagePath: text("storage_path").notNull().unique(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  assetKind: text("asset_kind").notNull(),
  title: text("title").notNull(),
  altText: text("alt_text"),
  status: text("status").notNull().default("pending"),
  sourceSystem: text("source_system"),
  sourceUrl: text("source_url"),
  importKey: text("import_key"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteContentAssetLinks = pgTable(
  "site_content_asset_links",
  {
    contentId: uuid("content_id").notNull().references(() => siteContentItems.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").notNull().references(() => siteContentAssets.id, { onDelete: "restrict" }),
    assetRole: text("asset_role").notNull(),
    publicLabel: text("public_label").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.contentId, table.assetId] })]
);

export const siteContentAudit = pgTable("site_content_audit", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  action: text("action").notNull(),
  actorId: uuid("actor_id"),
  summary: jsonb("summary").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Guichet numérique — demandes et conversation de support.
 * Les routes publiques passent exclusivement par les API serveur.
 */
export const supportRequests = pgTable("support_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  publicCode: text("public_code")
    .notNull()
    .unique()
    .default(
      sql`'BC-' || extract(year from current_date)::integer::text || '-' || lpad(nextval('public.support_request_number_seq')::text, 6, '0')`
    ),
  idempotencyKeyHash: text("idempotency_key_hash").notNull().unique(),
  requesterType: text("requester_type").notNull(),
  requesterFirstName: text("requester_first_name").notNull(),
  requesterLastName: text("requester_last_name").notNull(),
  beneficiaryType: text("beneficiary_type").notNull(),
  beneficiaryFirstName: text("beneficiary_first_name"),
  beneficiaryLastName: text("beneficiary_last_name"),
  studentId: uuid("student_id").references(() => eleves.id, {
    onDelete: "set null",
  }),
  classId: uuid("class_id").references(() => classes.id, {
    onDelete: "set null",
  }),
  professeurId: uuid("professeur_id").references(() => professeurs.id, {
    onDelete: "set null",
  }),
  subjectContext: jsonb("subject_context").notNull().default({}),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("nouveau"),
  priority: text("priority").notNull().default("p3"),
  priorityReason: text("priority_reason"),
  preferredChannel: text("preferred_channel").notNull(),
  fallbackAllowed: boolean("fallback_allowed").notNull().default(false),
  sourceIpHash: text("source_ip_hash"),
  assignedTo: uuid("assigned_to"),
  assignedTeam: text("assigned_team"),
  slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  retentionUntil: timestamp("retention_until", { withTimezone: true })
    .notNull()
    .default(sql`now() + interval '1 year'`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportContacts = pgTable("support_contacts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: uuid("request_id")
    .notNull()
    .references(() => supportRequests.id, { onDelete: "cascade" }),
  personType: text("person_type").notNull(),
  personReferenceId: uuid("person_reference_id"),
  channel: text("channel").notNull(),
  value: text("value").notNull(),
  normalizedHash: text("normalized_hash").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  verificationSource: text("verification_source"),
  usageScope: text("usage_scope").notNull().default("support"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportMessages = pgTable("support_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: uuid("request_id")
    .notNull()
    .references(() => supportRequests.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(),
  channel: text("channel").notNull(),
  authorUserId: uuid("author_user_id"),
  authorLabel: text("author_label"),
  bodyText: text("body_text").notNull(),
  bodyHtmlSanitized: text("body_html_sanitized"),
  clientIdempotencyKeyHash: text("client_idempotency_key_hash").unique(),
  provider: text("provider"),
  providerMessageId: text("provider_message_id"),
  inReplyTo: text("in_reply_to"),
  deliveryStatus: text("delivery_status").notNull().default("stored"),
  validatedBy: uuid("validated_by"),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportDeviceSessions = pgTable("support_device_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionHash: text("session_hash").notNull().unique(),
  label: text("label"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportSessionRequests = pgTable(
  "support_session_requests",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => supportDeviceSessions.id, { onDelete: "cascade" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => supportRequests.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "support_session_requests_pkey",
      columns: [table.sessionId, table.requestId],
    }),
  ]
);

export const supportMagicTokens = pgTable("support_magic_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: uuid("request_id")
    .notNull()
    .references(() => supportRequests.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id"),
  tokenHash: text("token_hash").notNull().unique(),
  purpose: text("purpose").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  attemptCount: integer("attempt_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportAttachments = pgTable("support_attachments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: uuid("request_id")
    .notNull()
    .references(() => supportRequests.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => supportMessages.id, {
    onDelete: "cascade",
  }),
  concernsType: text("concerns_type").notNull(),
  concernsLabel: text("concerns_label"),
  documentType: text("document_type").notNull(),
  note: text("note"),
  originalName: text("original_name").notNull(),
  declaredMime: text("declared_mime").notNull(),
  detectedMime: text("detected_mime"),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  sha256: text("sha256"),
  storageBucket: text("storage_bucket").notNull(),
  storagePath: text("storage_path").notNull().unique(),
  scanStatus: text("scan_status").notNull().default("quarantine"),
  scanDetail: text("scan_detail"),
  uploadedBySession: uuid("uploaded_by_session").references(
    () => supportDeviceSessions.id,
    { onDelete: "set null" }
  ),
  retentionUntil: timestamp("retention_until", { withTimezone: true }).notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportEvents = pgTable("support_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => supportRequests.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id"),
  fromValue: jsonb("from_value"),
  toValue: jsonb("to_value"),
  correlationId: uuid("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportJobRuns = pgTable("support_job_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").notNull(),
  jobType: text("job_type").notNull(),
  requestId: uuid("request_id").references(() => supportRequests.id, {
    onDelete: "cascade",
  }),
  attempt: integer("attempt").notNull(),
  status: text("status").notNull(),
  providerReference: text("provider_reference"),
  errorCode: text("error_code"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportFailedJobs = pgTable("support_failed_jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id").notNull().unique(),
  requestId: uuid("request_id").references(() => supportRequests.id, {
    onDelete: "cascade",
  }),
  jobType: text("job_type").notNull(),
  payloadRedacted: jsonb("payload_redacted").notNull(),
  attempts: integer("attempts").notNull(),
  lastErrorCode: text("last_error_code"),
  lastErrorSummary: text("last_error_summary"),
  failedAt: timestamp("failed_at", { withTimezone: true }).notNull().defaultNow(),
  retriedBy: uuid("retried_by"),
  retriedAt: timestamp("retried_at", { withTimezone: true }),
});

export const supportDeliveryEvents = pgTable("support_delivery_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: uuid("message_id")
    .notNull()
    .references(() => supportMessages.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerEventId: text("provider_event_id").notNull(),
  eventType: text("event_type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  payloadRedacted: jsonb("payload_redacted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportWebhookReceipts = pgTable("support_webhook_receipts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: text("status").notNull().default("received"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportCallbackTasks = pgTable("support_callback_tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: uuid("request_id")
    .notNull()
    .references(() => supportRequests.id, { onDelete: "cascade" }),
  phoneContactId: uuid("phone_contact_id")
    .notNull()
    .references(() => supportContacts.id, { onDelete: "cascade" }),
  assignedTo: uuid("assigned_to"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  status: text("status").notNull().default("todo"),
  outcome: text("outcome"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportTemplates = pgTable("support_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(),
  name: text("name").notNull(),
  subject: text("subject"),
  bodyText: text("body_text").notNull(),
  allowedVariables: jsonb("allowed_variables").notNull().default([]),
  version: integer("version").notNull().default(1),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportRateLimits = pgTable(
  "support_rate_limits",
  {
    scope: text("scope").notNull(),
    keyHash: text("key_hash").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    requestCount: integer("request_count").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "support_rate_limits_pkey",
      columns: [table.scope, table.keyHash],
    }),
  ]
);
