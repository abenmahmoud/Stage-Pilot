-- LyceeGest initial schema, recovered from the Supabase migration journal.
create extension if not exists "pgcrypto";

create table public.etablissement (
  id uuid primary key default gen_random_uuid(),
  nom text not null default 'Lycée Blaise Cendrars',
  adresse text not null default '12 avenue Léon Jouhaux',
  code_postal text not null default '93270',
  ville text not null default 'Sevran',
  telephone text default '01 49 36 20 50',
  email text default 'Ce.0932048w@ac-creteil.fr',
  uai text default '0932048W',
  nom_proviseur text not null default 'VER-EECKE',
  civilite_proviseur text default 'Mme',
  logo_url text,
  cachet_url text,
  annee_scolaire text default '2025-2026',
  date_stage_debut date default '2026-06-15',
  date_stage_fin date default '2026-06-26',
  date_limite_convention date default '2026-06-01',
  date_go_debut date default '2026-06-22',
  date_go_fin date default '2026-07-01',
  updated_at timestamptz default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  niveau text not null,
  annee_scolaire text not null default '2025-2026',
  professeur_principal_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
create unique index classes_nom_annee_uniq on public.classes (nom, annee_scolaire);

create table public.professeurs (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nom text not null,
  prenom text not null,
  email text not null unique,
  matieres text,
  role text not null default 'professeur',
  created_at timestamptz default now()
);
create index professeurs_email_idx on public.professeurs (email);

create table public.eleves (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nom text not null,
  prenom text not null,
  classe_id uuid references public.classes(id) on delete set null,
  email_eleve text,
  email_famille text,
  telephone_famille text,
  date_naissance date,
  numero_candidat text,
  code_acces text unique,
  annee_scolaire text not null default '2025-2026',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index eleves_classe_idx on public.eleves (classe_id);
create index eleves_nom_prenom_idx on public.eleves (nom, prenom);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  numero_convention integer default 1,
  statut text not null default 'a_completer',
  entreprise_nom text,
  entreprise_representant text,
  entreprise_qualite text,
  entreprise_adresse text,
  entreprise_telephone text,
  entreprise_email text,
  entreprise_type text,
  tuteur_nom_qualite text,
  tuteur_email text,
  tuteur_telephone text,
  horaire_lundi_matin_debut text,
  horaire_lundi_matin_fin text,
  horaire_lundi_apm_debut text,
  horaire_lundi_apm_fin text,
  horaire_mardi_matin_debut text,
  horaire_mardi_matin_fin text,
  horaire_mardi_apm_debut text,
  horaire_mardi_apm_fin text,
  horaire_mercredi_matin_debut text,
  horaire_mercredi_matin_fin text,
  horaire_mercredi_apm_debut text,
  horaire_mercredi_apm_fin text,
  horaire_jeudi_matin_debut text,
  horaire_jeudi_matin_fin text,
  horaire_jeudi_apm_debut text,
  horaire_jeudi_apm_fin text,
  horaire_vendredi_matin_debut text,
  horaire_vendredi_matin_fin text,
  horaire_vendredi_apm_debut text,
  horaire_vendredi_apm_fin text,
  date_debut date default '2026-06-15',
  date_fin date default '2026-06-26',
  fait_le date,
  professeur_referent_id uuid references auth.users(id) on delete set null,
  convention_pdf_url text,
  convention_generee_at timestamptz,
  notes_suivi text,
  date_visite date,
  compte_rendu_visite text,
  soumis_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index stages_eleve_idx on public.stages (eleve_id);
create index stages_statut_idx on public.stages (statut);
create index stages_referent_idx on public.stages (professeur_referent_id);

create table public.fiches_grand_oral (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  annee_scolaire text not null default '2025-2026',
  numero_candidat text,
  question_1 text,
  specialites_question_1 text,
  question_2 text,
  specialites_question_2 text,
  statut text not null default 'brouillon',
  signature_eleve_url text,
  signe_eleve_at timestamptz,
  prof_spe1_id uuid references auth.users(id) on delete set null,
  commentaire_prof1 text,
  signature_prof1_url text,
  signe_prof1_at timestamptz,
  prof_spe2_id uuid references auth.users(id) on delete set null,
  commentaire_prof2 text,
  signature_prof2_url text,
  signe_prof2_at timestamptz,
  signature_proviseur_url text,
  cachet_appose_at timestamptz,
  fiche_pdf_url text,
  pdf_genere_at timestamptz,
  soumis_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index fiches_go_eleve_idx on public.fiches_grand_oral (eleve_id);
create index fiches_go_statut_idx on public.fiches_grand_oral (statut);
create index fiches_go_prof1_idx on public.fiches_grand_oral (prof_spe1_id);
create index fiches_go_prof2_idx on public.fiches_grand_oral (prof_spe2_id);

create table public.import_logs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  fichier_nom text,
  nb_importes integer default 0,
  nb_doublons integer default 0,
  nb_erreurs integer default 0,
  detail_erreurs jsonb,
  importe_par text,
  created_at timestamptz default now()
);

create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  destinataire_email text not null,
  type_notif text not null,
  module text not null,
  reference_id uuid,
  envoi_ok boolean default false,
  erreur_message text,
  created_at timestamptz default now()
);

create table public.templates_documents (
  id uuid primary key default gen_random_uuid(),
  type text not null unique,
  nom text not null,
  contenu_json jsonb not null,
  version integer not null default 1,
  actif boolean default true,
  modifie_par text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
