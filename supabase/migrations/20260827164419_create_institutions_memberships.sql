begin;

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 2 and 160),
  timezone text not null default 'Europe/Paris' check (length(btrim(timezone)) > 0),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  status text not null default 'draft' check (
    status in ('draft', 'pilot', 'active', 'suspended')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.institution_memberships (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (
    role in ('agent', 'service_manager', 'admin', 'auditor')
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
  mfa_verified_at timestamptz,
  status text not null default 'invited' check (
    status in ('invited', 'active', 'disabled')
  ),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (institution_id, user_id),
  check (
    role in ('admin', 'auditor')
    or cardinality(service_codes) > 0
  )
);

create index institution_memberships_user_status_idx
  on public.institution_memberships (user_id, status);
create index institution_memberships_service_codes_idx
  on public.institution_memberships using gin (service_codes);

create trigger institutions_set_updated_at
before update on public.institutions
for each row execute function public.support_set_updated_at();

create trigger institution_memberships_set_updated_at
before update on public.institution_memberships
for each row execute function public.support_set_updated_at();

insert into public.institutions (slug, name, timezone, status)
values ('blaise-cendrars-sevran', 'Lycée Blaise Cendrars', 'Europe/Paris', 'pilot')
on conflict (slug) do nothing;

alter table public.institutions enable row level security;
alter table public.institutions force row level security;
alter table public.institution_memberships enable row level security;
alter table public.institution_memberships force row level security;

-- These tables are deliberately server-only during the pilot. The API checks
-- the signed-in user and reads them through the server-side service role.
revoke all on table
  public.institutions,
  public.institution_memberships
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.institutions,
  public.institution_memberships
to service_role;

comment on column public.institution_memberships.mfa_verified_at is
  'Audit snapshot only. Live MFA authorization must use the current Auth AAL.';

commit;
