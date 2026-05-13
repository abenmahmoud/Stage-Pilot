CREATE TABLE "classes" (
	"id" serial PRIMARY KEY,
	"nom" text NOT NULL,
	"niveau" text NOT NULL,
	"annee_scolaire" text DEFAULT '2025-2026' NOT NULL,
	"professeur_principal_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "eleves" (
	"id" serial PRIMARY KEY,
	"identity_id" text UNIQUE,
	"nom" text NOT NULL,
	"prenom" text NOT NULL,
	"classe_id" integer,
	"email_eleve" text,
	"email_famille" text,
	"telephone_famille" text,
	"date_naissance" date,
	"numero_candidat" text,
	"code_acces" text UNIQUE,
	"annee_scolaire" text DEFAULT '2025-2026' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "etablissement" (
	"id" serial PRIMARY KEY,
	"nom" text DEFAULT 'Lycée Blaise Cendrars' NOT NULL,
	"adresse" text DEFAULT '12 avenue Léon Jouhaux' NOT NULL,
	"code_postal" text DEFAULT '93270' NOT NULL,
	"ville" text DEFAULT 'Sevran' NOT NULL,
	"telephone" text DEFAULT '01 49 36 20 50',
	"email" text DEFAULT 'Ce.0932048w@ac-creteil.fr',
	"uai" text DEFAULT '0932048W',
	"nom_proviseur" text DEFAULT 'VER-EECKE' NOT NULL,
	"civilite_proviseur" text DEFAULT 'Mme',
	"logo_url" text,
	"cachet_url" text,
	"annee_scolaire" text DEFAULT '2025-2026',
	"date_stage_debut" date DEFAULT '2026-06-15',
	"date_stage_fin" date DEFAULT '2026-06-26',
	"date_limite_convention" date DEFAULT '2026-06-01',
	"date_go_debut" date DEFAULT '2026-06-22',
	"date_go_fin" date DEFAULT '2026-07-01',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fiches_grand_oral" (
	"id" serial PRIMARY KEY,
	"eleve_id" integer NOT NULL,
	"annee_scolaire" text DEFAULT '2025-2026' NOT NULL,
	"numero_candidat" text,
	"question_1" text,
	"specialites_question_1" text,
	"question_2" text,
	"specialites_question_2" text,
	"statut" text DEFAULT 'brouillon' NOT NULL,
	"signature_eleve_url" text,
	"signe_eleve_at" timestamp,
	"prof_spe1_id" integer,
	"commentaire_prof1" text,
	"signature_prof1_url" text,
	"signe_prof1_at" timestamp,
	"prof_spe2_id" integer,
	"commentaire_prof2" text,
	"signature_prof2_url" text,
	"signe_prof2_at" timestamp,
	"signature_proviseur_url" text,
	"cachet_appose_at" timestamp,
	"fiche_pdf_url" text,
	"pdf_genere_at" timestamp,
	"soumis_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "import_logs" (
	"id" serial PRIMARY KEY,
	"type" text NOT NULL,
	"fichier_nom" text,
	"nb_importes" integer DEFAULT 0,
	"nb_doublons" integer DEFAULT 0,
	"nb_erreurs" integer DEFAULT 0,
	"detail_erreurs" jsonb,
	"importe_par" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications_log" (
	"id" serial PRIMARY KEY,
	"destinataire_email" text NOT NULL,
	"type_notif" text NOT NULL,
	"module" text NOT NULL,
	"reference_id" integer,
	"envoi_ok" boolean DEFAULT false,
	"erreur_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "professeurs" (
	"id" serial PRIMARY KEY,
	"identity_id" text UNIQUE,
	"nom" text NOT NULL,
	"prenom" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"matieres" text,
	"role" text DEFAULT 'professeur' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" serial PRIMARY KEY,
	"eleve_id" integer NOT NULL,
	"numero_convention" integer DEFAULT 1,
	"statut" text DEFAULT 'a_completer' NOT NULL,
	"entreprise_nom" text,
	"entreprise_representant" text,
	"entreprise_qualite" text,
	"entreprise_adresse" text,
	"entreprise_telephone" text,
	"entreprise_email" text,
	"entreprise_type" text,
	"tuteur_nom_qualite" text,
	"tuteur_email" text,
	"tuteur_telephone" text,
	"horaire_lundi_matin_debut" text,
	"horaire_lundi_matin_fin" text,
	"horaire_lundi_apm_debut" text,
	"horaire_lundi_apm_fin" text,
	"horaire_mardi_matin_debut" text,
	"horaire_mardi_matin_fin" text,
	"horaire_mardi_apm_debut" text,
	"horaire_mardi_apm_fin" text,
	"horaire_mercredi_matin_debut" text,
	"horaire_mercredi_matin_fin" text,
	"horaire_mercredi_apm_debut" text,
	"horaire_mercredi_apm_fin" text,
	"horaire_jeudi_matin_debut" text,
	"horaire_jeudi_matin_fin" text,
	"horaire_jeudi_apm_debut" text,
	"horaire_jeudi_apm_fin" text,
	"horaire_vendredi_matin_debut" text,
	"horaire_vendredi_matin_fin" text,
	"horaire_vendredi_apm_debut" text,
	"horaire_vendredi_apm_fin" text,
	"date_debut" date DEFAULT '2026-06-15',
	"date_fin" date DEFAULT '2026-06-26',
	"fait_le" date,
	"professeur_referent_id" integer,
	"convention_pdf_url" text,
	"convention_generee_at" timestamp,
	"notes_suivi" text,
	"date_visite" date,
	"compte_rendu_visite" text,
	"soumis_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "templates_documents" (
	"id" serial PRIMARY KEY,
	"type" text NOT NULL UNIQUE,
	"nom" text NOT NULL,
	"contenu_json" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"actif" boolean DEFAULT true,
	"modifie_par" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "eleves" ADD CONSTRAINT "eleves_classe_id_classes_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id");--> statement-breakpoint
ALTER TABLE "fiches_grand_oral" ADD CONSTRAINT "fiches_grand_oral_eleve_id_eleves_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id");--> statement-breakpoint
ALTER TABLE "fiches_grand_oral" ADD CONSTRAINT "fiches_grand_oral_prof_spe1_id_professeurs_id_fkey" FOREIGN KEY ("prof_spe1_id") REFERENCES "professeurs"("id");--> statement-breakpoint
ALTER TABLE "fiches_grand_oral" ADD CONSTRAINT "fiches_grand_oral_prof_spe2_id_professeurs_id_fkey" FOREIGN KEY ("prof_spe2_id") REFERENCES "professeurs"("id");--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_eleve_id_eleves_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id");--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_professeur_referent_id_professeurs_id_fkey" FOREIGN KEY ("professeur_referent_id") REFERENCES "professeurs"("id");