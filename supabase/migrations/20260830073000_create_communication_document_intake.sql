begin;

create table public.communication_source_documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  communication_id uuid,
  original_name text not null check (
    length(btrim(original_name)) between 1 and 180
    and position('/' in original_name) = 0
    and position(chr(92) in original_name) = 0
  ),
  mime_type text not null check (
    mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  storage_bucket text not null default 'communication-ingest' check (
    storage_bucket = 'communication-ingest'
  ),
  storage_path text not null unique check (
    length(storage_path) between 20 and 500
    and position('@' in storage_path) = 0
  ),
  status text not null default 'reserved' check (
    status in ('reserved', 'uploaded', 'quarantined', 'processing', 'review', 'used', 'rejected', 'failed')
  ),
  checksum text check (checksum is null or checksum ~ '^[a-f0-9]{64}$'),
  extraction_summary jsonb not null default '{}'::jsonb check (
    jsonb_typeof(extraction_summary) = 'object'
  ),
  extracted_text text check (
    extracted_text is null or length(extracted_text) between 1 and 100000
  ),
  analysis_error text check (analysis_error is null or length(analysis_error) <= 500),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  uploaded_at timestamptz,
  analyzed_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  foreign key (communication_id, institution_id)
    references public.communications(id, institution_id) on delete restrict,
  check (status <> 'used' or communication_id is not null),
  check (communication_id is null or status = 'used'),
  check (extracted_text is null or status = 'review')
);

create unique index communication_source_documents_checksum_uidx
  on public.communication_source_documents (institution_id, checksum)
  where checksum is not null and status not in ('rejected', 'failed');
create index communication_source_documents_scope_status_idx
  on public.communication_source_documents (institution_id, status, created_at desc);
create index communication_source_documents_communication_scope_fk_idx
  on public.communication_source_documents (communication_id, institution_id)
  where communication_id is not null;
create index communication_source_documents_uploaded_by_idx
  on public.communication_source_documents (uploaded_by, created_at desc);

create table public.communication_source_events (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  source_document_id uuid not null,
  event_type text not null check (
    event_type in ('source.reserved', 'source.confirmed', 'source.scanned', 'source.rejected', 'source.failed', 'source.used')
  ),
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_type text not null check (actor_type in ('user', 'system')),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default transaction_timestamp(),
  check (
    (actor_type = 'user' and actor_user_id is not null)
    or (actor_type = 'system' and actor_user_id is null)
  ),
  foreign key (source_document_id, institution_id)
    references public.communication_source_documents(id, institution_id) on delete restrict
);

create index communication_source_events_source_scope_idx
  on public.communication_source_events (source_document_id, institution_id, created_at desc);
create index communication_source_events_scope_created_idx
  on public.communication_source_events (institution_id, created_at desc);
create index communication_source_events_actor_idx
  on public.communication_source_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

create or replace function public.communication_source_document_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'reserved'
    or new.communication_id is not null
    or new.checksum is not null
    or new.extraction_summary <> '{}'::jsonb
    or new.extracted_text is not null
    or new.analysis_error is not null
    or new.uploaded_at is not null
    or new.analyzed_at is not null then
    raise exception 'Communication source must start as a clean reservation';
  end if;
  return new;
end;
$$;

create or replace function public.communication_source_document_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.original_name <> old.original_name
    or new.mime_type <> old.mime_type
    or new.size_bytes <> old.size_bytes
    or new.storage_bucket <> old.storage_bucket
    or new.storage_path <> old.storage_path
    or new.uploaded_by <> old.uploaded_by
    or new.created_at <> old.created_at then
    raise exception 'Communication source identity is immutable';
  end if;
  if old.status in ('used', 'rejected') then
    raise exception 'Final communication source is immutable';
  end if;
  if not (
    (old.status = 'reserved' and new.status in ('reserved', 'uploaded', 'quarantined', 'rejected', 'failed'))
    or (old.status = 'uploaded' and new.status in ('uploaded', 'quarantined', 'rejected', 'failed'))
    or (old.status = 'quarantined' and new.status in ('quarantined', 'processing', 'rejected', 'failed'))
    or (old.status = 'processing' and new.status in ('processing', 'quarantined', 'review', 'rejected', 'failed'))
    or (old.status = 'review' and new.status in ('review', 'used', 'rejected', 'failed'))
    or (old.status = 'failed' and new.status in ('failed', 'quarantined', 'rejected'))
  ) then
    raise exception 'Invalid communication source lifecycle transition';
  end if;
  return new;
end;
$$;

create trigger communication_source_documents_insert_guard_trigger
before insert on public.communication_source_documents
for each row execute function public.communication_source_document_insert_guard();
create trigger communication_source_documents_guard_trigger
before update on public.communication_source_documents
for each row execute function public.communication_source_document_guard();
create trigger communication_source_documents_set_updated_at_trigger
before update on public.communication_source_documents
for each row execute function public.communication_set_updated_at();
create trigger communication_source_events_append_only_trigger
before update or delete on public.communication_source_events
for each row execute function public.communication_events_append_only();

alter table public.communication_source_documents enable row level security;
alter table public.communication_source_documents force row level security;
alter table public.communication_source_events enable row level security;
alter table public.communication_source_events force row level security;
revoke all on table public.communication_source_documents from public, anon, authenticated;
revoke all on table public.communication_source_events from public, anon, authenticated;
revoke all on sequence public.communication_source_events_id_seq from public, anon, authenticated;
revoke all on function public.communication_source_document_insert_guard() from public, anon, authenticated;
revoke all on function public.communication_source_document_guard() from public, anon, authenticated;
grant select, insert, update on table public.communication_source_documents to service_role;
grant select, insert on table public.communication_source_events to service_role;
grant usage, select on sequence public.communication_source_events_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'communication-ingest',
  'communication-ingest',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

select pgmq.create('communication_document_scan');
revoke all on table
  pgmq.q_communication_document_scan,
  pgmq.a_communication_document_scan
from public, anon, authenticated;
comment on table pgmq.q_communication_document_scan is
  'Private queue for antivirus and local PDF/DOCX communication extraction.';

commit;
