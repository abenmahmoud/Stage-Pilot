begin;

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null check (length(btrim(title)) between 2 and 180),
  source_type text not null check (
    source_type in ('official_url', 'internal_document', 'procedure', 'directory', 'calendar')
  ),
  uri text not null check (length(btrim(uri)) between 3 and 1000),
  classification text not null default 'internal' check (
    classification in ('public', 'internal', 'personal', 'sensitive')
  ),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
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
  valid_from timestamptz not null,
  expires_at timestamptz,
  status text not null default 'draft' check (
    status in ('draft', 'published', 'expired', 'revoked')
  ),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  check (expires_at is null or expires_at > valid_from),
  check (classification <> 'public' or cardinality(service_codes) = 0)
);

create index knowledge_sources_institution_status_idx
  on public.knowledge_sources (institution_id, status);
create index knowledge_sources_expiry_idx
  on public.knowledge_sources (expires_at);
create index knowledge_sources_service_codes_idx
  on public.knowledge_sources using gin (service_codes);

create table public.agent_skills (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  skill_key text not null check (skill_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 2 and 160),
  domain text not null check (length(btrim(domain)) between 2 and 100),
  active_version_id uuid,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  unique (institution_id, skill_key)
);

create index agent_skills_institution_enabled_idx
  on public.agent_skills (institution_id, enabled);

create table public.agent_skill_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  skill_id uuid not null,
  version text not null check (version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  status text not null default 'draft' check (
    status in ('draft', 'review', 'published', 'retired')
  ),
  definition jsonb not null default '{}'::jsonb check (jsonb_typeof(definition) = 'object'),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  data_classification text not null default 'internal' check (
    data_classification in ('public', 'internal', 'personal', 'sensitive')
  ),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  published_at timestamptz,
  review_due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  unique (id, skill_id, institution_id),
  unique (skill_id, version),
  foreign key (skill_id, institution_id)
    references public.agent_skills(id, institution_id) on delete cascade,
  check (review_due_at > created_at),
  check (
    (status = 'published' and published_at is not null and approved_by is not null)
    or status <> 'published'
  )
);

alter table public.agent_skills
  add constraint agent_skills_active_version_fk
  foreign key (active_version_id, id, institution_id)
  references public.agent_skill_versions(id, skill_id, institution_id)
  on delete restrict;

create index agent_skill_versions_status_review_idx
  on public.agent_skill_versions (institution_id, status, review_due_at);

create table public.skill_source_links (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  skill_version_id uuid not null,
  source_id uuid not null,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (skill_version_id, source_id),
  foreign key (skill_version_id, institution_id)
    references public.agent_skill_versions(id, institution_id) on delete cascade,
  foreign key (source_id, institution_id)
    references public.knowledge_sources(id, institution_id) on delete restrict
);

create index skill_source_links_source_idx
  on public.skill_source_links (source_id);

create table public.agent_evaluations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  skill_version_id uuid not null,
  test_case_key text not null check (test_case_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind text not null check (kind in ('positive', 'ambiguous', 'forbidden')),
  result text not null check (result in ('pass', 'fail', 'needs_review')),
  scores jsonb not null default '{}'::jsonb check (jsonb_typeof(scores) = 'object'),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  run_at timestamptz not null default now(),
  unique (skill_version_id, test_case_key),
  foreign key (skill_version_id, institution_id)
    references public.agent_skill_versions(id, institution_id) on delete cascade
);

create index agent_evaluations_institution_run_idx
  on public.agent_evaluations (institution_id, run_at);

create table public.agent_skill_audit (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  resource_type text not null check (resource_type in ('source', 'skill', 'version')),
  resource_id uuid not null,
  action text not null check (
    action in ('create', 'create_version', 'update', 'submit_review', 'publish', 'retire', 'rollback', 'expire', 'revoke')
  ),
  actor_id uuid not null references auth.users(id) on delete restrict,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now()
);

create index agent_skill_audit_resource_idx
  on public.agent_skill_audit (resource_type, resource_id, created_at desc);
create index agent_skill_audit_institution_created_idx
  on public.agent_skill_audit (institution_id, created_at desc);

create trigger knowledge_sources_set_updated_at
before update on public.knowledge_sources
for each row execute function public.support_set_updated_at();

create trigger agent_skills_set_updated_at
before update on public.agent_skills
for each row execute function public.support_set_updated_at();

create trigger agent_skill_versions_set_updated_at
before update on public.agent_skill_versions
for each row execute function public.support_set_updated_at();

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_sources force row level security;
alter table public.agent_skills enable row level security;
alter table public.agent_skills force row level security;
alter table public.agent_skill_versions enable row level security;
alter table public.agent_skill_versions force row level security;
alter table public.skill_source_links enable row level security;
alter table public.skill_source_links force row level security;
alter table public.agent_evaluations enable row level security;
alter table public.agent_evaluations force row level security;
alter table public.agent_skill_audit enable row level security;
alter table public.agent_skill_audit force row level security;

-- Pilot tables remain server-only. Every API route verifies the signed-in user,
-- current MFA state and persisted institution membership before using service_role.
revoke all on table
  public.knowledge_sources,
  public.agent_skills,
  public.agent_skill_versions,
  public.skill_source_links,
  public.agent_evaluations,
  public.agent_skill_audit
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.knowledge_sources,
  public.agent_skills,
  public.agent_skill_versions,
  public.skill_source_links,
  public.agent_evaluations,
  public.agent_skill_audit
to service_role;

commit;
