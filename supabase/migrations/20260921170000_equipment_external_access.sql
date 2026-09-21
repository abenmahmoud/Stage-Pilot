begin;

create table public.equipment_service_visit_requests (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  visit_id uuid not null references public.equipment_service_visits(id) on delete cascade,
  request_id uuid not null references public.support_requests(id) on delete cascade,
  assigned_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (visit_id, request_id)
);
create index equipment_service_visit_requests_scope_idx
  on public.equipment_service_visit_requests(institution_id, visit_id);
create index equipment_service_visit_requests_request_idx
  on public.equipment_service_visit_requests(request_id);

create table public.equipment_external_access_grants (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  visit_id uuid not null references public.equipment_service_visits(id) on delete cascade,
  label text not null check (char_length(label) between 2 and 120),
  code_hash text not null check (code_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  locked_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index equipment_external_access_grants_scope_idx
  on public.equipment_external_access_grants(institution_id, visit_id);
create index equipment_external_access_grants_visit_idx
  on public.equipment_external_access_grants(visit_id);
create index equipment_external_access_grants_expiry_idx
  on public.equipment_external_access_grants(expires_at);

create table public.equipment_external_updates (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  grant_id uuid not null references public.equipment_external_access_grants(id) on delete restrict,
  visit_id uuid not null references public.equipment_service_visits(id) on delete cascade,
  request_id uuid not null references public.support_requests(id) on delete cascade,
  client_idempotency_key_hash text not null check (client_idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  outcome text not null check (outcome in ('diagnosed', 'repaired', 'needs_followup', 'not_found', 'unavailable')),
  note text check (note is null or char_length(note) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index equipment_external_updates_visit_idx
  on public.equipment_external_updates(institution_id, visit_id, created_at);
create index equipment_external_updates_visit_fk_idx
  on public.equipment_external_updates(visit_id);
create index equipment_external_updates_grant_idx
  on public.equipment_external_updates(grant_id);
create index equipment_external_updates_request_idx
  on public.equipment_external_updates(request_id, created_at);
create unique index equipment_external_updates_idempotency_key
  on public.equipment_external_updates(grant_id, client_idempotency_key_hash);

alter table public.equipment_service_visit_requests enable row level security;
alter table public.equipment_service_visit_requests force row level security;
alter table public.equipment_external_access_grants enable row level security;
alter table public.equipment_external_access_grants force row level security;
alter table public.equipment_external_updates enable row level security;
alter table public.equipment_external_updates force row level security;

revoke all on table public.equipment_service_visit_requests from public, anon, authenticated;
revoke all on table public.equipment_external_access_grants from public, anon, authenticated;
revoke all on table public.equipment_external_updates from public, anon, authenticated;
grant select, insert, update, delete on table public.equipment_service_visit_requests to service_role;
grant select, insert, update on table public.equipment_external_access_grants to service_role;
grant select, insert on table public.equipment_external_updates to service_role;

comment on table public.equipment_external_access_grants is
  'Revocable, expiring, code-protected SPIE access grants. Plain access codes are never stored.';
comment on table public.equipment_external_updates is
  'Append-only technician outcomes for requests explicitly assigned to one equipment visit.';

commit;
