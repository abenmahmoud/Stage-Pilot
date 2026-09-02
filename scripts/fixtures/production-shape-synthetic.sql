-- Synthetic legacy fixture matching only the production table volumes observed
-- on 2026-09-02. No production value or identity is copied into this dataset.

do $fixture$
begin

insert into public.etablissement (
  nom,
  adresse,
  code_postal,
  ville,
  telephone,
  email,
  uai,
  nom_proviseur,
  civilite_proviseur,
  annee_scolaire
)
values (
  'Etablissement entièrement fictif',
  '1 rue des Tests',
  '00000',
  'Ville Exemple',
  '0100000000',
  'direction@example.test',
  '0000000X',
  'DIRECTION-SYNTHETIQUE',
  'Mme',
  '2025-2026'
);

insert into public.classes (nom, niveau, annee_scolaire)
select
  'SYN-' || lpad(g::text, 3, '0'),
  case (g - 1) % 4
    when 0 then 'Seconde fictive'
    when 1 then 'Première fictive'
    when 2 then 'Terminale fictive'
    else 'CAP fictif'
  end,
  '2025-2026'
from generate_series(1, 44) as g;

insert into public.professeurs (
  nom,
  prenom,
  email,
  matieres,
  role,
  code_acces
)
select
  'PROF-SYN-' || lpad(g::text, 3, '0'),
  'Prénom fictif',
  'prof' || lpad(g::text, 3, '0') || '@example.test',
  'Matière fictive',
  'professeur',
  'SYN-PROF-' || lpad(g::text, 4, '0')
from generate_series(1, 106) as g;

with class_rows as (
  select id, row_number() over (order by nom) as row_number
  from public.classes
  where nom like 'SYN-%'
)
insert into public.eleves (
  nom,
  prenom,
  classe_id,
  email_eleve,
  email_famille,
  telephone_famille,
  date_naissance,
  numero_candidat,
  code_acces,
  annee_scolaire
)
select
  'ELEVE-SYN-' || lpad(g::text, 4, '0'),
  'Prénom fictif',
  class_rows.id,
  'eleve' || lpad(g::text, 4, '0') || '@example.test',
  'famille' || lpad(g::text, 4, '0') || '@example.test',
  '0100' || lpad(g::text, 6, '0'),
  date '2008-01-01' + ((g - 1) % 365),
  'SYN-CAND-' || lpad(g::text, 5, '0'),
  'SYN-ELEVE-' || lpad(g::text, 5, '0'),
  '2025-2026'
from generate_series(1, 1159) as g
join class_rows
  on class_rows.row_number = ((g - 1) % 44) + 1;

insert into public.stages (
  eleve_id,
  statut,
  entreprise_nom,
  entreprise_email,
  date_debut,
  date_fin,
  notes_suivi
)
select
  id,
  'a_completer',
  'Entreprise fictive',
  'entreprise@example.test',
  date '2026-06-15',
  date '2026-06-26',
  'Donnée synthétique sans personne réelle.'
from public.eleves
where code_acces like 'SYN-ELEVE-%';

insert into public.fiches_grand_oral (
  eleve_id,
  annee_scolaire,
  question_1,
  question_2,
  statut
)
select
  id,
  '2025-2026',
  'Question fictive numéro 1',
  'Question fictive numéro 2',
  'brouillon'
from public.eleves
where code_acces like 'SYN-ELEVE-%'
order by code_acces
limit 2;

insert into public.import_logs (
  type,
  fichier_nom,
  nb_importes,
  nb_doublons,
  nb_erreurs,
  importe_par
)
values
  ('fixture', 'synthetic-legacy-01.csv', 0, 0, 0, 'local-test'),
  ('fixture', 'synthetic-legacy-02.csv', 0, 0, 0, 'local-test');

insert into public.templates_documents (
  type,
  nom,
  contenu_json,
  version,
  actif,
  modifie_par
)
select
  'synthetic-template-' || g,
  'Modèle fictif ' || g,
  jsonb_build_object('synthetic', true, 'index', g),
  1,
  true,
  'local-test'
from generate_series(1, 6) as g;

end
$fixture$;
