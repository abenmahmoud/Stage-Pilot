begin;

-- LOT 3 du plan `docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md` :
-- `source_format` était figé à 'pdf_import' (voir
-- `20260829105141_create_schedule_import_foundation.sql`), alors que
-- l'export dont Adel dispose aujourd'hui est un fichier tabulaire (CSV ou
-- Excel), et non un PDF. Ce lot ajoute un second format sans toucher au
-- circuit PDF existant : le point d'écriture des créneaux
-- (`api/_shared/schedule-slot-write.ts`) et le circuit de vérification par
-- page restent strictement identiques pour les deux formats.

alter table public.schedule_source_versions
  drop constraint schedule_source_versions_source_format_check;
alter table public.schedule_source_versions
  add constraint schedule_source_versions_source_format_check
    check (source_format in ('pdf_import', 'tabular_import'));

alter table public.schedule_source_versions
  drop constraint schedule_source_versions_mime_type_check;
alter table public.schedule_source_versions
  add constraint schedule_source_versions_mime_type_check
    check (
      (source_format = 'pdf_import' and mime_type = 'application/pdf')
      or (
        source_format = 'tabular_import'
        and mime_type in (
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
      )
    );

-- Nouvel état d'attente : un fichier tabulaire propre (antivirus + lecture
-- structurelle) ne peut pas recevoir de `page_count` avant que
-- l'administrateur n'ait fait correspondre les colonnes (classe/professeur,
-- matière, salle, jour, heures) — ce nombre de pages dépend justement de
-- cette correspondance (une page = une classe ou un professeur distinct
-- trouvé dans le fichier). Un PDF n'entre jamais dans cet état : son nombre
-- de pages est connu dès la lecture technique.
alter table public.schedule_source_versions
  drop constraint schedule_source_versions_status_check;
alter table public.schedule_source_versions
  add constraint schedule_source_versions_status_check
    check (
      status in (
        'reserved', 'uploaded', 'quarantined', 'processing', 'mapping_pending',
        'review', 'approved', 'active', 'superseded', 'rejected', 'failed', 'retired'
      )
    );

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
where id = 'schedule-ingest';

alter table public.schedule_audit
  drop constraint schedule_audit_action_check;
alter table public.schedule_audit
  add constraint schedule_audit_action_check
    check (
      action in (
        'reserve_upload', 'confirm_upload', 'reject_upload', 'complete_scan',
        'index_page', 'verify_page', 'write_slots', 'approve', 'activate',
        'supersede', 'rollback', 'open_page', 'retire', 'apply_tabular_mapping'
      )
    );

-- Correspondance de colonnes choisie par un administrateur pour un fichier
-- tabulaire, conservée pour préremplir le prochain import du même périmètre
-- (classes ou professeurs) — c'est ce qui évite de refaire la correspondance
-- à chaque nouvel export.
create table public.schedule_tabular_column_mappings (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  source_kind text not null check (source_kind in ('classes', 'teachers')),
  mapping jsonb not null check (jsonb_typeof(mapping) = 'object'),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (institution_id, source_kind)
);

alter table public.schedule_tabular_column_mappings enable row level security;
alter table public.schedule_tabular_column_mappings force row level security;

revoke all on table public.schedule_tabular_column_mappings from public, anon, authenticated;
grant select, insert, update, delete on table public.schedule_tabular_column_mappings to service_role;

commit;
