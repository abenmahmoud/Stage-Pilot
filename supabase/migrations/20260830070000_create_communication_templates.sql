begin;

create table public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  template_key text not null check (template_key in ('hebdo', 'urgent', 'rentree', 'document', 'evenement', 'rappel')),
  label text not null check (length(btrim(label)) between 2 and 80),
  default_category text not null check (default_category ~ '^[a-z][a-z0-9_-]{1,39}$'),
  title_hint text not null default '' check (length(title_hint) <= 180),
  summary_hint text not null default '' check (length(summary_hint) <= 1000),
  body_markdown text not null check (length(body_markdown) between 1 and 20000),
  active boolean not null default true,
  version integer not null default 1 check (version between 1 and 10000),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (institution_id, template_key)
);

create table public.communication_template_events (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  template_id uuid not null,
  event_type text not null check (event_type in ('template.customized', 'template.updated')),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  version integer not null check (version between 1 and 10000),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default transaction_timestamp(),
  foreign key (template_id, institution_id)
    references public.communication_templates(id, institution_id) on delete restrict
);

create index communication_templates_scope_active_idx
  on public.communication_templates (institution_id, active, template_key);
create index communication_templates_created_by_idx
  on public.communication_templates (created_by, created_at desc);
create index communication_templates_updated_by_idx
  on public.communication_templates (updated_by, updated_at desc);
create index communication_template_events_template_scope_idx
  on public.communication_template_events (template_id, institution_id, created_at desc);
create index communication_template_events_scope_created_idx
  on public.communication_template_events (institution_id, created_at desc);
create index communication_template_events_actor_idx
  on public.communication_template_events (actor_user_id, created_at desc);

create or replace function public.communication_template_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.template_key <> old.template_key
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'Communication template identity is immutable';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'Communication template version must increment exactly once';
  end if;
  return new;
end;
$$;

create trigger communication_templates_guard_trigger
before update on public.communication_templates
for each row execute function public.communication_template_guard();

create trigger communication_templates_set_updated_at_trigger
before update on public.communication_templates
for each row execute function public.communication_set_updated_at();

create trigger communication_template_events_append_only_trigger
before update or delete on public.communication_template_events
for each row execute function public.communication_events_append_only();

alter table public.communication_templates enable row level security;
alter table public.communication_templates force row level security;
alter table public.communication_template_events enable row level security;
alter table public.communication_template_events force row level security;

revoke all on table public.communication_templates from public, anon, authenticated;
revoke all on table public.communication_template_events from public, anon, authenticated;
revoke all on sequence public.communication_template_events_id_seq from public, anon, authenticated;
revoke all on function public.communication_template_guard() from public, anon, authenticated;

grant select, insert, update on table public.communication_templates to service_role;
grant select, insert on table public.communication_template_events to service_role;
grant usage, select on sequence public.communication_template_events_id_seq to service_role;

commit;
