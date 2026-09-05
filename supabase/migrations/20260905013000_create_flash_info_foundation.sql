begin;

create table public.flash_infos (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  current_version integer not null default 1 check (current_version between 1 and 10000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id)
);

create index flash_infos_scope_status_idx
  on public.flash_infos (institution_id, status, updated_at desc);
create index flash_infos_created_by_idx
  on public.flash_infos (created_by, created_at desc);

create table public.flash_info_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  flash_info_id uuid not null,
  version integer not null check (version between 1 and 10000),
  previous_version_id uuid,
  status text not null default 'proposee' check (
    status in ('proposee', 'validee', 'publiee', 'modifiee', 'expiree_sans_validation', 'refusee')
  ),
  title text not null check (length(btrim(title)) between 2 and 180),
  body_markdown text not null check (length(body_markdown) between 1 and 20000),
  importance text not null default 'normale' check (importance in ('normale', 'importante', 'urgente')),
  channels jsonb not null default '[]'::jsonb check (
    jsonb_typeof(channels) = 'array'
    and (
      (importance = 'normale' and channels = '[]'::jsonb)
      or (importance = 'importante' and channels @> '["push"]'::jsonb and channels <@ '["push", "email"]'::jsonb)
      or (importance = 'urgente' and channels @> '["push", "email"]'::jsonb and channels <@ '["push", "email", "sms"]'::jsonb)
    )
  ),
  expires_at timestamptz not null check (expires_at > created_at),
  proposed_by uuid not null references auth.users(id) on delete restrict,
  validated_by uuid references auth.users(id) on delete restrict,
  validated_at timestamptz,
  published_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (flash_info_id, version),
  foreign key (flash_info_id, institution_id)
    references public.flash_infos(id, institution_id) on delete restrict,
  foreign key (previous_version_id, institution_id)
    references public.flash_info_versions(id, institution_id) on delete restrict,
  check ((version = 1) = (previous_version_id is null)),
  check ((validated_by is null) = (validated_at is null)),
  check (status not in ('validee', 'publiee', 'modifiee', 'refusee') or validated_at is not null),
  check (status not in ('proposee', 'expiree_sans_validation') or (validated_by is null and validated_at is null)),
  check (status <> 'publiee' or published_at is not null),
  check (status = 'modifiee' or superseded_at is null),
  check (status <> 'modifiee' or superseded_at is not null)
);

create index flash_info_versions_scope_status_idx
  on public.flash_info_versions (institution_id, flash_info_id, status, version desc);
create index flash_info_versions_proposed_by_idx
  on public.flash_info_versions (proposed_by, created_at desc);
create index flash_info_versions_validated_by_idx
  on public.flash_info_versions (validated_by, validated_at desc)
  where validated_by is not null;
create index flash_info_versions_expiration_pending_idx
  on public.flash_info_versions (expires_at)
  where status = 'proposee';

create table public.flash_info_audiences (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  version_id uuid not null,
  group_ref text not null check (
    group_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,79}$' and position('@' in group_ref) = 0
  ),
  created_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (version_id, group_ref),
  foreign key (version_id, institution_id)
    references public.flash_info_versions(id, institution_id) on delete restrict
);

create index flash_info_audiences_version_scope_idx
  on public.flash_info_audiences (version_id, institution_id);
create index flash_info_audiences_scope_group_idx
  on public.flash_info_audiences (institution_id, group_ref);

create table public.flash_notification_dispatches (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  version_id uuid not null,
  channel text not null check (channel in ('push', 'email', 'sms')),
  group_ref text check (
    group_ref is null or (group_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,79}$' and position('@' in group_ref) = 0)
  ),
  contact_ref text check (
    contact_ref is null or (contact_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$' and position('@' in contact_ref) = 0)
  ),
  status text not null default 'sent' check (status in ('sent', 'skipped', 'failed')),
  sent_at timestamptz not null default transaction_timestamp(),
  created_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  foreign key (version_id, institution_id)
    references public.flash_info_versions(id, institution_id) on delete restrict,
  check (
    (channel = 'sms' and contact_ref is not null and group_ref is null)
    or (channel in ('push', 'email') and group_ref is not null and contact_ref is null)
  )
);

create index flash_notification_dispatches_version_scope_idx
  on public.flash_notification_dispatches (version_id, institution_id, channel, status);
create index flash_notification_dispatches_scope_status_idx
  on public.flash_notification_dispatches (institution_id, status, sent_at desc);

create table public.flash_correction_decisions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  flash_info_id uuid not null,
  version_id uuid not null,
  gap_kind text not null check (gap_kind in ('decisif', 'forme')),
  initiated_by text not null default 'agent' check (initiated_by in ('agent', 'human')),
  decision text not null default 'en_attente' check (decision in ('en_attente', 'confirmee', 'refusee')),
  maintained_count integer not null default 0 check (maintained_count >= 0),
  removed_count integer not null default 0 check (removed_count >= 0),
  added_count integer not null default 0 check (added_count >= 0),
  eligible_channels jsonb not null default '[]'::jsonb check (
    jsonb_typeof(eligible_channels) = 'array'
    and eligible_channels <@ '["push", "email", "sms"]'::jsonb
  ),
  requested_by uuid references auth.users(id) on delete restrict,
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (version_id),
  foreign key (flash_info_id, institution_id)
    references public.flash_infos(id, institution_id) on delete restrict,
  foreign key (version_id, institution_id)
    references public.flash_info_versions(id, institution_id) on delete restrict,
  check ((initiated_by = 'human') = (requested_by is not null)),
  check (gap_kind = 'decisif' or initiated_by = 'human'),
  check ((decision = 'en_attente') = (decided_by is null and decided_at is null))
);

create index flash_correction_decisions_scope_idx
  on public.flash_correction_decisions (institution_id, flash_info_id, created_at desc);
create index flash_correction_decisions_pending_idx
  on public.flash_correction_decisions (institution_id, decision)
  where decision = 'en_attente';

create table public.flash_info_events (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  flash_info_id uuid not null,
  resource_type text not null check (
    resource_type in ('flash_info', 'version', 'audience', 'notification', 'correction_decision')
  ),
  resource_id uuid not null,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*)+$'),
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_type text not null check (actor_type in ('user', 'system')),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default transaction_timestamp(),
  foreign key (flash_info_id, institution_id)
    references public.flash_infos(id, institution_id) on delete restrict
);

create index flash_info_events_scope_created_idx
  on public.flash_info_events (institution_id, flash_info_id, created_at desc);
create index flash_info_events_resource_created_idx
  on public.flash_info_events (resource_type, resource_id, created_at desc);
create index flash_info_events_actor_idx
  on public.flash_info_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

create or replace function public.flash_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := transaction_timestamp();
  return new;
end;
$$;

create or replace function public.flash_info_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'draft' or new.current_version <> 1 then
    raise exception 'flash_info_must_start_draft';
  end if;
  return new;
end;
$$;

create or replace function public.flash_guard_root()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'Flash info identity is immutable';
  end if;
  return new;
end;
$$;

create or replace function public.flash_info_version_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'proposee'
    or new.validated_by is not null
    or new.validated_at is not null
    or new.published_at is not null
    or new.superseded_at is not null then
    raise exception 'flash_info_version_must_start_proposee';
  end if;
  return new;
end;
$$;

create or replace function public.flash_guard_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.flash_info_id <> old.flash_info_id
    or new.version <> old.version
    or new.previous_version_id is distinct from old.previous_version_id
    or new.proposed_by <> old.proposed_by
    or new.created_at <> old.created_at then
    raise exception 'Flash info version scope is immutable';
  end if;

  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'proposee' and new.status in ('validee', 'refusee', 'expiree_sans_validation'))
    or (old.status = 'validee' and new.status = 'publiee')
    or (old.status = 'publiee' and new.status = 'modifiee')
  ) then
    raise exception 'invalid_flash_info_version_transition';
  end if;
  return new;
end;
$$;

create or replace function public.flash_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Flash info events are append-only';
end;
$$;

create or replace function public.flash_correction_decision_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.decision <> 'en_attente' or new.decided_by is not null or new.decided_at is not null then
    raise exception 'flash_correction_decision_must_start_en_attente';
  end if;
  return new;
end;
$$;

create or replace function public.flash_correction_decision_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.flash_info_id <> old.flash_info_id
    or new.version_id <> old.version_id
    or new.gap_kind <> old.gap_kind
    or new.initiated_by <> old.initiated_by
    or new.requested_by is distinct from old.requested_by
    or new.created_at <> old.created_at then
    raise exception 'Flash correction decision scope is immutable';
  end if;
  if old.decision <> 'en_attente' and new.decision <> old.decision then
    raise exception 'Flash correction decision is already final';
  end if;
  return new;
end;
$$;

create trigger flash_infos_insert_guard_trigger
before insert on public.flash_infos
for each row execute function public.flash_info_insert_guard();
create trigger flash_infos_guard_trigger
before update on public.flash_infos
for each row execute function public.flash_guard_root();
create trigger flash_infos_set_updated_at_trigger
before update on public.flash_infos
for each row execute function public.flash_set_updated_at();

create trigger flash_info_versions_insert_guard_trigger
before insert on public.flash_info_versions
for each row execute function public.flash_info_version_insert_guard();
create trigger flash_info_versions_guard_trigger
before update on public.flash_info_versions
for each row execute function public.flash_guard_version();
create trigger flash_info_versions_set_updated_at_trigger
before update on public.flash_info_versions
for each row execute function public.flash_set_updated_at();

create trigger flash_info_events_append_only_trigger
before update or delete on public.flash_info_events
for each row execute function public.flash_events_append_only();

create trigger flash_correction_decisions_insert_guard_trigger
before insert on public.flash_correction_decisions
for each row execute function public.flash_correction_decision_insert_guard();
create trigger flash_correction_decisions_guard_trigger
before update on public.flash_correction_decisions
for each row execute function public.flash_correction_decision_guard();

alter table public.flash_infos enable row level security;
alter table public.flash_infos force row level security;
alter table public.flash_info_versions enable row level security;
alter table public.flash_info_versions force row level security;
alter table public.flash_info_audiences enable row level security;
alter table public.flash_info_audiences force row level security;
alter table public.flash_notification_dispatches enable row level security;
alter table public.flash_notification_dispatches force row level security;
alter table public.flash_correction_decisions enable row level security;
alter table public.flash_correction_decisions force row level security;
alter table public.flash_info_events enable row level security;
alter table public.flash_info_events force row level security;

revoke all on table public.flash_infos from public, anon, authenticated;
revoke all on table public.flash_info_versions from public, anon, authenticated;
revoke all on table public.flash_info_audiences from public, anon, authenticated;
revoke all on table public.flash_notification_dispatches from public, anon, authenticated;
revoke all on table public.flash_correction_decisions from public, anon, authenticated;
revoke all on table public.flash_info_events from public, anon, authenticated;
revoke all on sequence public.flash_info_events_id_seq from public, anon, authenticated;
revoke all on function public.flash_set_updated_at() from public, anon, authenticated;
revoke all on function public.flash_info_insert_guard() from public, anon, authenticated;
revoke all on function public.flash_guard_root() from public, anon, authenticated;
revoke all on function public.flash_info_version_insert_guard() from public, anon, authenticated;
revoke all on function public.flash_guard_version() from public, anon, authenticated;
revoke all on function public.flash_events_append_only() from public, anon, authenticated;
revoke all on function public.flash_correction_decision_insert_guard() from public, anon, authenticated;
revoke all on function public.flash_correction_decision_guard() from public, anon, authenticated;

grant select, insert, update on table public.flash_infos to service_role;
grant select, insert, update on table public.flash_info_versions to service_role;
grant select, insert on table public.flash_info_audiences to service_role;
grant select, insert on table public.flash_notification_dispatches to service_role;
grant select, insert, update on table public.flash_correction_decisions to service_role;
grant select, insert on table public.flash_info_events to service_role;
grant usage, select on sequence public.flash_info_events_id_seq to service_role;

comment on table public.flash_infos is
  'Flash info root record. The flash is a supplementary channel and never the emergency channel; publication and every correction still require human validation (see flash_info_versions and flash_correction_decisions).';
comment on column public.flash_info_versions.expires_at is
  'Not-null by construction: enforces that no flash info version, including a published one, can exist without an expiration.';
comment on column public.flash_notification_dispatches.status is
  'Only status = sent counts as a real notification; it is this trace, not the declared importance, that decides whether a later correction may reuse a channel.';
comment on column public.flash_correction_decisions.gap_kind is
  'decisif = date, heure, lieu, annulation, public or importance changed; forme = wording only. The agent only auto-proposes a correction on decisif (see the check tying gap_kind = forme to initiated_by = human).';
comment on column public.flash_correction_decisions.eligible_channels is
  'Channels that actually notified the previous version, derived from flash_notification_dispatches; bounds which channels a correction may use.';

commit;
