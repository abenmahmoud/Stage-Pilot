begin;

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  source_id uuid,
  title text not null check (length(btrim(title)) between 2 and 180),
  purpose_description text not null check (
    length(btrim(purpose_description)) between 20 and 4000
  ),
  source_type text not null check (
    source_type in ('internal_document', 'procedure', 'directory', 'calendar')
  ),
  classification text not null default 'internal' check (
    classification in ('public', 'internal', 'personal', 'sensitive')
  ),
  service_codes text[] not null default array[]::text[] check (
    service_codes <@ array[
      'referent_numerique',
      'ddfpt',
      'secretariat',
      'vie_scolaire',
      'intendance',
      'direction',
      'administration'
    ]::text[]
    and array_position(service_codes, null) is null
  ),
  original_name text not null check (length(btrim(original_name)) between 1 and 255),
  mime_type text not null check (length(btrim(mime_type)) between 3 and 150),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  storage_bucket text not null default 'knowledge-ingest' check (
    storage_bucket = 'knowledge-ingest'
  ),
  storage_path text not null unique,
  status text not null default 'reserved' check (
    status in (
      'reserved', 'uploaded', 'quarantined', 'processing', 'review',
      'ready', 'rejected', 'failed'
    )
  ),
  checksum text check (checksum is null or checksum ~ '^[a-f0-9]{64}$'),
  analysis_summary text,
  proposed_knowledge jsonb not null default '{}'::jsonb check (
    jsonb_typeof(proposed_knowledge) = 'object'
  ),
  analysis_error text,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  uploaded_at timestamptz,
  analyzed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (source_id, institution_id)
    references public.knowledge_sources(id, institution_id) on delete restrict,
  check (classification <> 'public' or cardinality(service_codes) = 0),
  check (source_id is null or status = 'ready')
);

create index knowledge_documents_institution_status_idx
  on public.knowledge_documents (institution_id, status, created_at desc);
create index knowledge_documents_service_codes_idx
  on public.knowledge_documents using gin (service_codes);

create trigger knowledge_documents_set_updated_at
before update on public.knowledge_documents
for each row execute function public.support_set_updated_at();

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_documents force row level security;
revoke all on table public.knowledge_documents from public, anon, authenticated;
grant select, insert, update, delete on table public.knowledge_documents to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-ingest',
  'knowledge-ingest',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.agent_skill_audit
  drop constraint agent_skill_audit_resource_type_check;
alter table public.agent_skill_audit
  add constraint agent_skill_audit_resource_type_check check (
    resource_type in ('source', 'skill', 'version', 'document')
  );

alter table public.agent_skill_audit
  drop constraint agent_skill_audit_action_check;
alter table public.agent_skill_audit
  add constraint agent_skill_audit_action_check check (
    action in (
      'create', 'create_version', 'update', 'submit_review', 'publish',
      'retire', 'rollback', 'expire', 'revoke', 'reserve_upload',
      'confirm_upload', 'reject_upload', 'queue_analysis',
      'complete_analysis', 'review_document'
    )
  );

commit;
