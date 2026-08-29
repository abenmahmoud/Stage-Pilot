begin;

create table public.schedule_source_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  source_kind text not null check (source_kind in ('classes', 'teachers')),
  source_format text not null default 'pdf_import' check (source_format = 'pdf_import'),
  school_year text not null check (school_year ~ '^[0-9]{4}-[0-9]{4}$'),
  version integer not null check (version between 1 and 10000),
  title text not null check (length(btrim(title)) between 2 and 180),
  purpose_description text not null check (length(btrim(purpose_description)) between 20 and 2000),
  effective_from date not null,
  original_name text not null check (length(btrim(original_name)) between 5 and 255),
  mime_type text not null check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  storage_bucket text not null default 'schedule-ingest' check (storage_bucket = 'schedule-ingest'),
  storage_path text not null unique,
  checksum text check (checksum is null or checksum ~ '^[a-f0-9]{64}$'),
  page_count integer check (page_count between 1 and 500),
  status text not null default 'reserved' check (
    status in (
      'reserved', 'uploaded', 'quarantined', 'processing', 'review',
      'approved', 'active', 'superseded', 'rejected', 'failed', 'retired'
    )
  ),
  validation_summary jsonb not null default '{}'::jsonb check (
    jsonb_typeof(validation_summary) = 'object'
  ),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  activated_by uuid references auth.users(id) on delete restrict,
  uploaded_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  constraint schedule_source_versions_scope_version_uidx
    unique (institution_id, source_kind, school_year, version),
  check (
    status not in ('approved', 'active', 'superseded')
    or (approved_by is not null and approved_at is not null)
  ),
  check (
    status not in ('active', 'superseded')
    or (activated_by is not null and activated_at is not null)
  )
);

create unique index schedule_source_versions_one_active_uidx
  on public.schedule_source_versions (institution_id, source_kind, school_year)
  where status = 'active';
create index schedule_source_versions_institution_status_idx
  on public.schedule_source_versions (institution_id, status, created_at desc);
create index schedule_source_versions_uploaded_by_idx
  on public.schedule_source_versions (uploaded_by) where uploaded_by is not null;
create index schedule_source_versions_reviewed_by_idx
  on public.schedule_source_versions (reviewed_by) where reviewed_by is not null;
create index schedule_source_versions_approved_by_idx
  on public.schedule_source_versions (approved_by) where approved_by is not null;
create index schedule_source_versions_activated_by_idx
  on public.schedule_source_versions (activated_by) where activated_by is not null;

create table public.schedule_page_indexes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  source_version_id uuid not null,
  page_number integer not null check (page_number between 1 and 500),
  subject_type text not null check (subject_type in ('class', 'teacher')),
  subject_ref text not null check (subject_ref ~ '^[A-Z0-9][A-Z0-9._:-]{1,79}$'),
  review_status text not null default 'draft' check (
    review_status in ('draft', 'verified', 'rejected')
  ),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (source_version_id, institution_id)
    references public.schedule_source_versions(id, institution_id) on delete cascade,
  constraint schedule_page_indexes_source_page_uidx
    unique (source_version_id, page_number),
  constraint schedule_page_indexes_source_subject_uidx
    unique (source_version_id, subject_type, subject_ref),
  check (
    review_status = 'draft'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create index schedule_page_indexes_source_institution_idx
  on public.schedule_page_indexes (source_version_id, institution_id);
create index schedule_page_indexes_subject_idx
  on public.schedule_page_indexes (institution_id, subject_type, subject_ref, review_status);
create index schedule_page_indexes_reviewed_by_idx
  on public.schedule_page_indexes (reviewed_by) where reviewed_by is not null;

create table public.schedule_audit (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  source_version_id uuid not null,
  page_index_id uuid,
  action text not null check (
    action in (
      'reserve_upload', 'confirm_upload', 'reject_upload', 'complete_scan',
      'index_page', 'verify_page', 'approve', 'activate', 'supersede',
      'open_page', 'retire'
    )
  ),
  actor_id uuid not null references auth.users(id) on delete restrict,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (source_version_id, institution_id)
    references public.schedule_source_versions(id, institution_id) on delete cascade,
  foreign key (page_index_id, institution_id)
    references public.schedule_page_indexes(id, institution_id) on delete restrict
);

create index schedule_audit_source_institution_idx
  on public.schedule_audit (source_version_id, institution_id, created_at desc);
create index schedule_audit_page_institution_idx
  on public.schedule_audit (page_index_id, institution_id) where page_index_id is not null;
create index schedule_audit_actor_idx
  on public.schedule_audit (actor_id, created_at desc);

create trigger schedule_source_versions_set_updated_at
before update on public.schedule_source_versions
for each row execute function public.support_set_updated_at();

create trigger schedule_page_indexes_set_updated_at
before update on public.schedule_page_indexes
for each row execute function public.support_set_updated_at();

alter table public.schedule_source_versions enable row level security;
alter table public.schedule_source_versions force row level security;
alter table public.schedule_page_indexes enable row level security;
alter table public.schedule_page_indexes force row level security;
alter table public.schedule_audit enable row level security;
alter table public.schedule_audit force row level security;

revoke all on table
  public.schedule_source_versions,
  public.schedule_page_indexes,
  public.schedule_audit
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.schedule_source_versions,
  public.schedule_page_indexes,
  public.schedule_audit
to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'schedule-ingest',
  'schedule-ingest',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
