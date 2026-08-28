begin;

select pgmq.create('identity_directory_scan');

create table public.identity_directory_rows (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  import_id uuid not null,
  source_sheet text not null check (length(source_sheet) between 1 and 80),
  row_number integer not null check (row_number >= 2 and row_number <= 25001),
  record_type text not null check (record_type in ('person', 'relationship', 'unknown')),
  person_ref text check (person_ref is null or length(person_ref) between 3 and 120),
  person_type text check (person_type is null or person_type in ('student', 'guardian', 'staff')),
  subject_person_ref text check (
    subject_person_ref is null or length(subject_person_ref) between 3 and 120
  ),
  relationship_type text check (
    relationship_type is null
    or relationship_type in ('self', 'guardian_of', 'member_of', 'teaches', 'manages')
  ),
  object_ref text check (object_ref is null or length(object_ref) between 3 and 120),
  class_ref text check (class_ref is null or length(class_ref) between 3 and 120),
  service_code text check (service_code is null or length(service_code) between 3 and 120),
  academic_email_hash text check (
    academic_email_hash is null or academic_email_hash ~ '^[a-f0-9]{64}$'
  ),
  personal_email_hash text check (
    personal_email_hash is null or personal_email_hash ~ '^[a-f0-9]{64}$'
  ),
  phone_hash text check (phone_hash is null or phone_hash ~ '^[a-f0-9]{64}$'),
  valid_from date,
  valid_until date,
  validation_status text not null check (
    validation_status in ('valid', 'warning', 'rejected')
  ),
  issues jsonb not null default '[]'::jsonb check (jsonb_typeof(issues) = 'array'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (import_id, institution_id)
    references public.identity_directory_imports(id, institution_id) on delete cascade,
  unique (import_id, source_sheet, row_number),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create index identity_directory_rows_import_status_idx
  on public.identity_directory_rows (import_id, validation_status, row_number);
create index identity_directory_rows_person_ref_idx
  on public.identity_directory_rows (institution_id, person_ref)
  where person_ref is not null;
create index identity_directory_rows_subject_ref_idx
  on public.identity_directory_rows (institution_id, subject_person_ref)
  where subject_person_ref is not null;
create index identity_directory_rows_academic_hash_idx
  on public.identity_directory_rows (institution_id, academic_email_hash)
  where academic_email_hash is not null;
create index identity_directory_rows_personal_hash_idx
  on public.identity_directory_rows (institution_id, personal_email_hash)
  where personal_email_hash is not null;
create index identity_directory_rows_phone_hash_idx
  on public.identity_directory_rows (institution_id, phone_hash)
  where phone_hash is not null;

alter table public.identity_directory_rows enable row level security;
alter table public.identity_directory_rows force row level security;

revoke all on table public.identity_directory_rows from public, anon, authenticated;
grant select, insert, update, delete on table public.identity_directory_rows to service_role;
grant usage, select on sequence public.identity_directory_rows_id_seq to service_role;

revoke all on table
  pgmq.q_identity_directory_scan,
  pgmq.a_identity_directory_scan
from public, anon, authenticated;

comment on table public.identity_directory_rows is
  'Quarantine report only. Contact factors are keyed hashes; names and raw contacts are never stored.';

commit;
