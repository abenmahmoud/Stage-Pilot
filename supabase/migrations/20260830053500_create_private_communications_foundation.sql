begin;

create table public.communication_settings (
  institution_id uuid primary key references public.institutions(id) on delete restrict,
  module_enabled boolean not null default false,
  publication_enabled boolean not null default false,
  sending_enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default transaction_timestamp(),
  check (module_enabled or (not publication_enabled and not sending_enabled))
);

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  source_type text not null check (
    source_type in ('direct_text', 'pdf', 'docx', 'image', 'forwarded_email')
  ),
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  source_label text not null check (length(btrim(source_label)) between 1 and 200),
  source_received_at timestamptz not null default transaction_timestamp(),
  status text not null default 'draft' check (
    status in ('draft', 'review', 'approved', 'published', 'archived', 'cancelled')
  ),
  visibility text not null default 'internal' check (
    visibility in ('public', 'internal', 'targeted')
  ),
  category text not null default 'information' check (
    category ~ '^[a-z][a-z0-9_-]{1,39}$'
  ),
  template_key text check (
    template_key is null or template_key ~ '^[a-z][a-z0-9_-]{1,39}$'
  ),
  public_slug text check (
    public_slug is null or public_slug ~ '^[a-z0-9][a-z0-9-]{2,119}$'
  ),
  site_content_id uuid references public.site_content_items(id) on delete restrict,
  current_version integer not null default 1 check (current_version between 1 and 10000),
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  publish_at timestamptz,
  expires_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (institution_id, source_fingerprint),
  unique (institution_id, public_slug),
  check ((approved_by is null) = (approved_at is null)),
  check (expires_at is null or expires_at > coalesce(publish_at, created_at)),
  check (published_at is null or (visibility = 'public' and site_content_id is not null)),
  check (status <> 'published' or published_at is not null),
  check (status not in ('approved', 'published') or approved_at is not null),
  check (archived_at is null or status = 'archived')
);

create index communications_institution_status_updated_idx
  on public.communications (institution_id, status, updated_at desc);
create index communications_institution_visibility_publish_idx
  on public.communications (institution_id, visibility, publish_at)
  where status in ('approved', 'published');
create index communications_site_content_idx
  on public.communications (site_content_id)
  where site_content_id is not null;
create index communications_created_by_idx
  on public.communications (created_by, created_at desc);
create index communications_approved_by_idx
  on public.communications (approved_by, approved_at desc)
  where approved_by is not null;

create table public.communication_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  communication_id uuid not null,
  version integer not null check (version between 1 and 10000),
  status text not null default 'draft' check (
    status in ('draft', 'review', 'approved', 'published', 'superseded')
  ),
  title text not null check (length(btrim(title)) between 2 and 180),
  summary text not null default '' check (length(summary) <= 1000),
  body_markdown text not null check (length(body_markdown) between 1 and 100000),
  structured_facts jsonb not null default '{}'::jsonb check (
    jsonb_typeof(structured_facts) = 'object'
  ),
  open_questions jsonb not null default '[]'::jsonb check (
    jsonb_typeof(open_questions) = 'array'
  ),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (communication_id, version),
  unique (id, institution_id, communication_id, version),
  foreign key (communication_id, institution_id)
    references public.communications(id, institution_id) on delete restrict,
  check ((approved_by is null) = (approved_at is null)),
  check (status not in ('approved', 'published', 'superseded') or approved_at is not null)
);

create index communication_versions_scope_status_idx
  on public.communication_versions (institution_id, communication_id, status, version desc);
create index communication_versions_created_by_idx
  on public.communication_versions (created_by, created_at desc);
create index communication_versions_approved_by_idx
  on public.communication_versions (approved_by, approved_at desc)
  where approved_by is not null;

create table public.communication_audiences (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  communication_id uuid not null,
  group_ref text not null check (
    group_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,79}$' and position('@' in group_ref) = 0
  ),
  status text not null default 'active' check (status in ('active', 'removed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  removed_by uuid references auth.users(id) on delete restrict,
  removed_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (communication_id, group_ref),
  foreign key (communication_id, institution_id)
    references public.communications(id, institution_id) on delete restrict,
  check (
    (status = 'active' and removed_by is null and removed_at is null)
    or (status = 'removed' and removed_by is not null and removed_at is not null)
  )
);

create index communication_audiences_scope_status_idx
  on public.communication_audiences (institution_id, communication_id, status);
create index communication_audiences_created_by_idx
  on public.communication_audiences (created_by, created_at desc);
create index communication_audiences_removed_by_idx
  on public.communication_audiences (removed_by, removed_at desc)
  where removed_by is not null;

create table public.communication_deliveries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  communication_id uuid not null,
  version_id uuid not null,
  version integer not null,
  contact_ref text not null check (
    contact_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$' and position('@' in contact_ref) = 0
  ),
  channel text not null default 'email' check (channel in ('email')),
  status text not null default 'prepared' check (
    status in ('prepared', 'queued', 'sent', 'delivered', 'deferred', 'rejected', 'unsubscribed', 'error', 'cancelled')
  ),
  idempotency_key_hash text not null check (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  provider_message_ref text check (
    provider_message_ref is null
    or (length(provider_message_ref) between 1 and 200 and position('@' in provider_message_ref) = 0)
  ),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  last_error_code text check (
    last_error_code is null or last_error_code ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{1,79}$'
  ),
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default transaction_timestamp(),
  created_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (institution_id, idempotency_key_hash),
  foreign key (communication_id, institution_id)
    references public.communications(id, institution_id) on delete restrict,
  foreign key (version_id, institution_id, communication_id, version)
    references public.communication_versions(id, institution_id, communication_id, version) on delete restrict
);

create index communication_deliveries_scope_status_idx
  on public.communication_deliveries (institution_id, communication_id, status, updated_at desc);
create index communication_deliveries_version_idx
  on public.communication_deliveries (version_id, institution_id);
create index communication_deliveries_provider_message_idx
  on public.communication_deliveries (provider_message_ref)
  where provider_message_ref is not null;

create table public.communication_jobs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  communication_id uuid not null,
  version_id uuid,
  version integer,
  delivery_id uuid,
  job_type text not null check (
    job_type in ('publish', 'prepare_delivery', 'send_delivery', 'retry_delivery', 'cancel_delivery', 'weekly_digest')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'running', 'retry', 'completed', 'dead', 'cancelled')
  ),
  idempotency_key_hash text not null check (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  run_after timestamptz not null default transaction_timestamp(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error_code text check (
    last_error_code is null or last_error_code ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{1,79}$'
  ),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (institution_id, idempotency_key_hash),
  foreign key (communication_id, institution_id)
    references public.communications(id, institution_id) on delete restrict,
  foreign key (version_id, institution_id, communication_id, version)
    references public.communication_versions(id, institution_id, communication_id, version) on delete restrict,
  foreign key (delivery_id, institution_id)
    references public.communication_deliveries(id, institution_id) on delete restrict,
  check ((version_id is null) = (version is null)),
  check (status <> 'completed' or completed_at is not null),
  check (status <> 'running' or locked_at is not null)
);

create index communication_jobs_claim_idx
  on public.communication_jobs (status, run_after, created_at)
  where status in ('pending', 'retry');
create index communication_jobs_scope_status_idx
  on public.communication_jobs (institution_id, communication_id, status, created_at desc);
create index communication_jobs_version_idx
  on public.communication_jobs (version_id, institution_id)
  where version_id is not null;
create index communication_jobs_delivery_idx
  on public.communication_jobs (delivery_id, institution_id)
  where delivery_id is not null;

create table public.communication_inbound (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  communication_id uuid,
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,39}$'),
  external_message_hash text not null check (external_message_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'received' check (
    status in ('received', 'matched', 'review', 'processed', 'rejected', 'error')
  ),
  classification text check (
    classification is null or classification in ('withdrawal', 'contact_correction', 'question', 'free_reply', 'forwarded_source')
  ),
  storage_ref text check (
    storage_ref is null or (storage_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9/._:-]{7,239}$' and position('@' in storage_ref) = 0)
  ),
  created_draft_id uuid,
  received_at timestamptz not null default transaction_timestamp(),
  processed_at timestamptz,
  error_code text check (
    error_code is null or error_code ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{1,79}$'
  ),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (institution_id, provider, external_message_hash),
  foreign key (communication_id, institution_id)
    references public.communications(id, institution_id) on delete restrict,
  foreign key (created_draft_id, institution_id)
    references public.communications(id, institution_id) on delete restrict
);

create index communication_inbound_scope_status_idx
  on public.communication_inbound (institution_id, status, received_at desc);
create index communication_inbound_communication_idx
  on public.communication_inbound (communication_id, institution_id)
  where communication_id is not null;
create index communication_inbound_created_draft_idx
  on public.communication_inbound (created_draft_id, institution_id)
  where created_draft_id is not null;

create table public.communication_events (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  communication_id uuid not null,
  resource_type text not null check (
    resource_type in ('communication', 'version', 'audience', 'delivery', 'job', 'inbound', 'settings')
  ),
  resource_id uuid not null,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*)+$'),
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_type text not null check (actor_type in ('user', 'system', 'provider')),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default transaction_timestamp(),
  foreign key (communication_id, institution_id)
    references public.communications(id, institution_id) on delete restrict
);

create index communication_events_scope_created_idx
  on public.communication_events (institution_id, communication_id, created_at desc);
create index communication_events_resource_created_idx
  on public.communication_events (resource_type, resource_id, created_at desc);
create index communication_events_actor_idx
  on public.communication_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

create or replace function public.communication_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := transaction_timestamp();
  return new;
end;
$$;

create or replace function public.communication_guard_root()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.source_type <> old.source_type
    or new.source_fingerprint <> old.source_fingerprint
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'Communication source and scope are immutable';
  end if;
  return new;
end;
$$;

create or replace function public.communication_guard_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then
    raise exception 'Validated communication versions are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if new.institution_id <> old.institution_id
    or new.communication_id <> old.communication_id
    or new.version <> old.version
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'Communication version scope is immutable';
  end if;
  if old.status in ('approved', 'published', 'superseded') then
    raise exception 'Validated communication versions are immutable';
  end if;
  return new;
end;
$$;

create or replace function public.communication_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Communication events are append-only';
end;
$$;

create trigger communications_guard_root_trigger
before update on public.communications
for each row execute function public.communication_guard_root();
create trigger communications_set_updated_at_trigger
before update on public.communications
for each row execute function public.communication_set_updated_at();
create trigger communication_versions_guard_trigger
before update or delete on public.communication_versions
for each row execute function public.communication_guard_version();
create trigger communication_versions_set_updated_at_trigger
before update on public.communication_versions
for each row execute function public.communication_set_updated_at();
create trigger communication_deliveries_set_updated_at_trigger
before update on public.communication_deliveries
for each row execute function public.communication_set_updated_at();
create trigger communication_jobs_set_updated_at_trigger
before update on public.communication_jobs
for each row execute function public.communication_set_updated_at();
create trigger communication_inbound_set_updated_at_trigger
before update on public.communication_inbound
for each row execute function public.communication_set_updated_at();
create trigger communication_events_append_only_trigger
before update or delete on public.communication_events
for each row execute function public.communication_events_append_only();

alter table public.communication_settings enable row level security;
alter table public.communication_settings force row level security;
alter table public.communications enable row level security;
alter table public.communications force row level security;
alter table public.communication_versions enable row level security;
alter table public.communication_versions force row level security;
alter table public.communication_audiences enable row level security;
alter table public.communication_audiences force row level security;
alter table public.communication_deliveries enable row level security;
alter table public.communication_deliveries force row level security;
alter table public.communication_jobs enable row level security;
alter table public.communication_jobs force row level security;
alter table public.communication_inbound enable row level security;
alter table public.communication_inbound force row level security;
alter table public.communication_events enable row level security;
alter table public.communication_events force row level security;

revoke all on table public.communication_settings from public, anon, authenticated;
revoke all on table public.communications from public, anon, authenticated;
revoke all on table public.communication_versions from public, anon, authenticated;
revoke all on table public.communication_audiences from public, anon, authenticated;
revoke all on table public.communication_deliveries from public, anon, authenticated;
revoke all on table public.communication_jobs from public, anon, authenticated;
revoke all on table public.communication_inbound from public, anon, authenticated;
revoke all on table public.communication_events from public, anon, authenticated;
revoke all on sequence public.communication_events_id_seq from public, anon, authenticated;
revoke all on function public.communication_set_updated_at() from public, anon, authenticated;
revoke all on function public.communication_guard_root() from public, anon, authenticated;
revoke all on function public.communication_guard_version() from public, anon, authenticated;
revoke all on function public.communication_events_append_only() from public, anon, authenticated;

grant select, insert, update on table public.communication_settings to service_role;
grant select, insert, update on table public.communications to service_role;
grant select, insert, update on table public.communication_versions to service_role;
grant select, insert, update on table public.communication_audiences to service_role;
grant select, insert, update on table public.communication_deliveries to service_role;
grant select, insert, update on table public.communication_jobs to service_role;
grant select, insert, update on table public.communication_inbound to service_role;
grant select, insert on table public.communication_events to service_role;
grant usage, select on sequence public.communication_events_id_seq to service_role;

commit;
