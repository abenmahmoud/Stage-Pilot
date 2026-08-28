begin;

create table public.identity_directory_imports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null check (length(btrim(title)) between 2 and 180),
  purpose_description text not null check (
    length(btrim(purpose_description)) between 20 and 2000
  ),
  source_type text not null check (
    source_type in ('csv', 'xlsx', 'official_export')
  ),
  original_name text not null check (length(btrim(original_name)) between 1 and 255),
  mime_type text not null check (
    mime_type in (
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  ),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  storage_bucket text not null default 'identity-ingest' check (
    storage_bucket = 'identity-ingest'
  ),
  storage_path text not null unique,
  checksum text check (checksum is null or checksum ~ '^[a-f0-9]{64}$'),
  status text not null default 'reserved' check (
    status in (
      'reserved', 'uploaded', 'quarantined', 'parsing', 'review',
      'approved', 'active', 'superseded', 'rejected', 'failed'
    )
  ),
  row_count integer check (row_count is null or row_count >= 0),
  valid_row_count integer check (valid_row_count is null or valid_row_count >= 0),
  rejected_row_count integer check (rejected_row_count is null or rejected_row_count >= 0),
  validation_summary jsonb not null default '{}'::jsonb check (
    jsonb_typeof(validation_summary) = 'object'
  ),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  uploaded_at timestamptz,
  approved_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  check (
    row_count is null
    or coalesce(valid_row_count, 0) + coalesce(rejected_row_count, 0) <= row_count
  ),
  check (status not in ('approved', 'active', 'superseded') or approved_by is not null),
  check (status <> 'active' or activated_at is not null)
);

create table public.contact_verifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  support_session_id uuid references public.support_device_sessions(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  contact_hash text not null check (contact_hash ~ '^[a-f0-9]{64}$'),
  purpose text not null check (purpose in ('signup', 'recovery', 'link_identity')),
  status text not null default 'pending' check (
    status in ('pending', 'verified', 'expired', 'blocked')
  ),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(user_id, support_session_id) = 1),
  check (expires_at > created_at),
  check (consumed_at is null or status = 'verified')
);

create table public.school_identities (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_import_id uuid not null,
  person_type text not null check (person_type in ('student', 'guardian', 'staff')),
  official_person_ref text not null check (
    length(btrim(official_person_ref)) between 4 and 200
  ),
  assurance_level text not null check (
    assurance_level in ('directory_matched', 'official_sso')
  ),
  verified_by uuid references auth.users(id) on delete restrict,
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (source_import_id, institution_id)
    references public.identity_directory_imports(id, institution_id) on delete restrict,
  check (assurance_level <> 'directory_matched' or verified_by is not null)
);

create table public.school_relationships (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_identity_id uuid not null,
  object_person_ref text not null check (
    length(btrim(object_person_ref)) between 4 and 200
  ),
  relationship_type text not null check (
    relationship_type in ('self', 'guardian_of', 'member_of', 'teaches', 'manages')
  ),
  valid_from date not null,
  valid_until date,
  source_import_id uuid not null,
  status text not null default 'active' check (
    status in ('active', 'revoked', 'expired')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_identity_id, institution_id)
    references public.school_identities(id, institution_id) on delete cascade,
  foreign key (source_import_id, institution_id)
    references public.identity_directory_imports(id, institution_id) on delete restrict,
  check (valid_until is null or valid_until >= valid_from),
  unique (
    institution_id,
    subject_identity_id,
    object_person_ref,
    relationship_type,
    source_import_id
  )
);

create table public.identity_directory_audit (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  resource_type text not null check (
    resource_type in ('import', 'contact_verification', 'identity', 'relationship')
  ),
  resource_id uuid not null,
  action text not null check (
    action in (
      'reserve_upload', 'confirm_upload', 'reject_upload', 'queue_scan',
      'complete_parse', 'approve', 'activate', 'supersede', 'revoke',
      'verify_contact', 'link_identity', 'link_relationship'
    )
  ),
  actor_id uuid references auth.users(id) on delete set null,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now()
);

create index identity_directory_imports_status_idx
  on public.identity_directory_imports (institution_id, status, created_at desc);
create unique index identity_directory_one_active_idx
  on public.identity_directory_imports (institution_id)
  where status = 'active';
create index contact_verifications_subject_idx
  on public.contact_verifications (institution_id, user_id, support_session_id, status);
create unique index contact_verifications_one_pending_idx
  on public.contact_verifications (institution_id, channel, contact_hash, purpose)
  where status = 'pending';
create index contact_verifications_expiry_idx
  on public.contact_verifications (expires_at)
  where status = 'pending';
create unique index school_identities_active_user_type_idx
  on public.school_identities (institution_id, user_id, person_type)
  where revoked_at is null;
create unique index school_identities_active_official_ref_idx
  on public.school_identities (institution_id, official_person_ref, person_type)
  where revoked_at is null;
create index school_relationships_subject_active_idx
  on public.school_relationships (institution_id, subject_identity_id, status, valid_until);
create index school_relationships_object_active_idx
  on public.school_relationships (institution_id, object_person_ref, status, valid_until);
create index identity_directory_audit_resource_idx
  on public.identity_directory_audit (resource_type, resource_id, created_at desc);
create index identity_directory_audit_institution_idx
  on public.identity_directory_audit (institution_id, created_at desc);

create trigger identity_directory_imports_set_updated_at
before update on public.identity_directory_imports
for each row execute function public.support_set_updated_at();
create trigger contact_verifications_set_updated_at
before update on public.contact_verifications
for each row execute function public.support_set_updated_at();
create trigger school_identities_set_updated_at
before update on public.school_identities
for each row execute function public.support_set_updated_at();
create trigger school_relationships_set_updated_at
before update on public.school_relationships
for each row execute function public.support_set_updated_at();

alter table public.identity_directory_imports enable row level security;
alter table public.identity_directory_imports force row level security;
alter table public.contact_verifications enable row level security;
alter table public.contact_verifications force row level security;
alter table public.school_identities enable row level security;
alter table public.school_identities force row level security;
alter table public.school_relationships enable row level security;
alter table public.school_relationships force row level security;
alter table public.identity_directory_audit enable row level security;
alter table public.identity_directory_audit force row level security;

revoke all on table
  public.identity_directory_imports,
  public.contact_verifications,
  public.school_identities,
  public.school_relationships,
  public.identity_directory_audit
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.identity_directory_imports,
  public.contact_verifications,
  public.school_identities,
  public.school_relationships,
  public.identity_directory_audit
to service_role;
grant usage, select on sequence public.identity_directory_audit_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-ingest',
  'identity-ingest',
  false,
  52428800,
  array[
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.identity_directory_imports is
  'Private intake only. Imported people never become general AI knowledge.';
comment on column public.contact_verifications.contact_hash is
  'One-way fingerprint only. OTP values and raw contacts are never stored here.';
comment on column public.school_identities.official_person_ref is
  'Opaque reference from an approved directory version; never inferred from chat.';

commit;
