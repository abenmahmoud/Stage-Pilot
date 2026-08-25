begin;

create or replace function public.support_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create extension if not exists pgmq;
select pgmq.create('support_jobs');
select pgmq.create('support_file_scan');

create sequence public.support_request_number_seq;

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique default (
    'BC-' || extract(year from current_date)::integer::text || '-' ||
    lpad(nextval('public.support_request_number_seq')::text, 6, '0')
  ),
  idempotency_key_hash text not null unique,
  requester_type text not null check (
    requester_type in ('eleve', 'parent', 'professeur', 'personnel', 'autre')
  ),
  requester_first_name text not null,
  requester_last_name text not null,
  beneficiary_type text not null check (
    beneficiary_type in ('self', 'eleve', 'professeur', 'personnel', 'autre')
  ),
  beneficiary_first_name text,
  beneficiary_last_name text,
  student_id uuid,
  class_id uuid,
  professeur_id uuid,
  subject_context jsonb not null default '{}'::jsonb,
  category text not null check (
    category in ('ent', 'email_academique', 'ordinateur', 'logiciel', 'autre')
  ),
  subcategory text,
  subject text not null,
  description text not null,
  status text not null default 'nouveau' check (
    status in (
      'brouillon', 'nouveau', 'a_qualifier', 'assigne', 'en_cours',
      'attente_demandeur', 'attente_interne', 'resolu', 'clos', 'indesirable'
    )
  ),
  priority text not null default 'p3' check (priority in ('p1', 'p2', 'p3', 'p4')),
  priority_reason text,
  preferred_channel text not null check (preferred_channel in ('email', 'phone', 'web')),
  fallback_allowed boolean not null default false,
  source_ip_hash text,
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_team text,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  retention_until timestamptz not null default (now() + interval '1 year'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'clos' or resolved_at is not null)
);

-- Add links to existing Gest records when those tables are present. Keeping the
-- migration valid on a clean database makes local verification possible.
do $$
begin
  if to_regclass('public.eleves') is not null then
    alter table public.support_requests
      add constraint support_requests_student_id_fkey
      foreign key (student_id) references public.eleves(id) on delete set null;
  end if;
  if to_regclass('public.classes') is not null then
    alter table public.support_requests
      add constraint support_requests_class_id_fkey
      foreign key (class_id) references public.classes(id) on delete set null;
  end if;
  if to_regclass('public.professeurs') is not null then
    alter table public.support_requests
      add constraint support_requests_professeur_id_fkey
      foreign key (professeur_id) references public.professeurs(id) on delete set null;
  end if;
end
$$;

create table public.support_contacts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.support_requests(id) on delete cascade,
  person_type text not null,
  person_reference_id uuid,
  channel text not null check (channel in ('email', 'phone')),
  value text not null,
  normalized_hash text not null,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  verification_source text,
  usage_scope text not null default 'support',
  verified_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  channel text not null check (channel in ('web', 'email', 'sms', 'phone', 'system')),
  author_user_id uuid references auth.users(id) on delete set null,
  author_label text,
  body_text text not null,
  body_html_sanitized text,
  client_idempotency_key_hash text unique,
  provider text,
  provider_message_id text,
  in_reply_to text,
  delivery_status text not null default 'stored',
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.support_device_sessions (
  id uuid primary key default gen_random_uuid(),
  session_hash text not null unique,
  label text,
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.support_session_requests (
  session_id uuid not null references public.support_device_sessions(id) on delete cascade,
  request_id uuid not null references public.support_requests(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (session_id, request_id)
);

create table public.support_magic_tokens (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete cascade,
  message_id uuid references public.support_messages(id) on delete cascade,
  concerns_type text not null,
  concerns_label text,
  document_type text not null,
  note text,
  original_name text not null,
  declared_mime text not null,
  detected_mime text,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text,
  storage_bucket text not null,
  storage_path text not null unique,
  scan_status text not null default 'awaiting_upload' check (
    scan_status in ('awaiting_upload', 'quarantine', 'clean', 'blocked', 'scan_error')
  ),
  scan_detail text,
  uploaded_by_session uuid references public.support_device_sessions(id) on delete set null,
  retention_until timestamptz not null,
  uploaded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.support_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.support_requests(id) on delete cascade,
  event_type text not null,
  actor_type text not null,
  actor_id text,
  from_value jsonb,
  to_value jsonb,
  correlation_id uuid not null,
  created_at timestamptz not null default now()
);

create table public.support_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  job_type text not null,
  request_id uuid references public.support_requests(id) on delete cascade,
  attempt integer not null,
  status text not null,
  provider_reference text,
  error_code text,
  duration_ms integer,
  created_at timestamptz not null default now(),
  unique (job_id, attempt)
);

create table public.support_failed_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique,
  request_id uuid references public.support_requests(id) on delete cascade,
  job_type text not null,
  payload_redacted jsonb not null,
  attempts integer not null,
  last_error_code text,
  last_error_summary text,
  failed_at timestamptz not null default now(),
  retried_by uuid references auth.users(id) on delete set null,
  retried_at timestamptz
);

create table public.support_delivery_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.support_messages(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  payload_redacted jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id, event_type)
);

create table public.support_webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  payload_hash text not null,
  status text not null default 'received',
  processed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  unique (provider, external_id, payload_hash)
);

create table public.support_callback_tasks (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete cascade,
  phone_contact_id uuid not null references public.support_contacts(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  outcome text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.support_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  subject text,
  body_text text not null,
  allowed_variables jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_requests_queue_idx
  on public.support_requests (status, priority, created_at);
create index support_requests_assignment_idx
  on public.support_requests (assigned_to, status, sla_due_at);
create index support_requests_category_idx
  on public.support_requests (category, created_at);
create index support_requests_class_idx
  on public.support_requests (class_id, created_at)
  where class_id is not null;
create index support_contacts_request_idx
  on public.support_contacts (request_id, channel);
create index support_contacts_hash_idx
  on public.support_contacts (normalized_hash, channel);
create index support_messages_thread_idx
  on public.support_messages (request_id, created_at);
create unique index support_messages_provider_unique_idx
  on public.support_messages (provider, provider_message_id)
  where provider is not null and provider_message_id is not null;
create index support_sessions_expiry_idx
  on public.support_device_sessions (expires_at)
  where revoked_at is null;
create index support_attachments_scan_idx
  on public.support_attachments (scan_status, created_at);
create index support_events_request_idx
  on public.support_events (request_id, created_at);
create index support_failed_jobs_date_idx
  on public.support_failed_jobs (failed_at);
create index support_callbacks_queue_idx
  on public.support_callback_tasks (status, due_at);

create trigger support_requests_set_updated_at
before update on public.support_requests
for each row execute function public.support_set_updated_at();

create trigger support_templates_set_updated_at
before update on public.support_templates
for each row execute function public.support_set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'support-quarantine',
    'support-quarantine',
    false,
    10485760,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'support-clean',
    'support-clean',
    false,
    10485760,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  );

alter table public.support_requests enable row level security;
alter table public.support_contacts enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_device_sessions enable row level security;
alter table public.support_session_requests enable row level security;
alter table public.support_magic_tokens enable row level security;
alter table public.support_attachments enable row level security;
alter table public.support_events enable row level security;
alter table public.support_job_runs enable row level security;
alter table public.support_failed_jobs enable row level security;
alter table public.support_delivery_events enable row level security;
alter table public.support_webhook_receipts enable row level security;
alter table public.support_callback_tasks enable row level security;
alter table public.support_templates enable row level security;

revoke all on table
  public.support_requests,
  public.support_contacts,
  public.support_messages,
  public.support_device_sessions,
  public.support_session_requests,
  public.support_magic_tokens,
  public.support_attachments,
  public.support_events,
  public.support_job_runs,
  public.support_failed_jobs,
  public.support_delivery_events,
  public.support_webhook_receipts,
  public.support_callback_tasks,
  public.support_templates
from anon, authenticated;

revoke all on sequence public.support_request_number_seq from anon, authenticated;

commit;
