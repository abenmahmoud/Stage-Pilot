alter table public.support_requests
  drop constraint if exists support_requests_category_check;

alter table public.support_requests
  add constraint support_requests_category_check check (
    category in (
      'inscription',
      'affectation_classe',
      'documents_scolarite',
      'ent',
      'email_academique',
      'ordinateur',
      'logiciel',
      'restauration_bourse',
      'orientation_formation',
      'vie_scolaire',
      'autre'
    )
  );
