begin;

create table public.equipment_service_visits (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null default 'SPIE' check (char_length(provider) between 2 and 80),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'completed', 'cancelled')),
  location text check (location is null or char_length(location) between 1 and 120),
  public_note text check (public_note is null or char_length(public_note) between 1 and 300),
  internal_note text check (internal_note is null or char_length(internal_note) between 1 and 1000),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_service_visits_time_order check (ends_at > starts_at),
  constraint equipment_service_visits_duration check (ends_at <= starts_at + interval '12 hours')
);

create index equipment_service_visits_public_idx
  on public.equipment_service_visits(institution_id, status, starts_at);

create table public.equipment_service_visit_events (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  visit_id uuid not null references public.equipment_service_visits(id) on delete cascade,
  event_type text not null,
  actor_id uuid not null,
  previous_value jsonb,
  next_value jsonb,
  created_at timestamptz not null default now()
);
create index equipment_service_visit_events_history_idx
  on public.equipment_service_visit_events(visit_id, created_at);

alter table public.equipment_service_visits enable row level security;
alter table public.equipment_service_visits force row level security;
alter table public.equipment_service_visit_events enable row level security;
alter table public.equipment_service_visit_events force row level security;
revoke all on table public.equipment_service_visits from public, anon, authenticated;
revoke all on table public.equipment_service_visit_events from public, anon, authenticated;
grant select, insert, update, delete on table public.equipment_service_visits to service_role;
grant select, insert on table public.equipment_service_visit_events to service_role;

comment on table public.equipment_service_visits is
  'SPIE or other equipment-provider visits. Public access is restricted to a server-side projection of confirmed visits.';

commit;
