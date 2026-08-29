begin;

select pgmq.create('identity_directory_lookup');

create table public.identity_directory_lookup_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  search_type text not null check (
    search_type in ('academic_email', 'personal_email', 'phone', 'person_ref')
  ),
  reason_category text not null check (
    reason_category in ('support_case', 'identity_verification', 'contact_correction', 'other')
  ),
  justification_hash text not null check (justification_hash ~ '^[a-f0-9]{64}$'),
  request_schema smallint not null default 1 check (request_schema = 1),
  request_key_version text not null check (
    request_key_version ~ '^v[1-9][0-9]{0,3}$'
  ),
  request_wrapped_key text not null check (
    length(request_wrapped_key) between 128 and 2048
    and request_wrapped_key ~ '^[A-Za-z0-9+/]+={0,2}$'
  ),
  request_iv text not null check (
    length(request_iv) between 16 and 24 and request_iv ~ '^[A-Za-z0-9+/]+={0,2}$'
  ),
  request_auth_tag text not null check (
    length(request_auth_tag) between 20 and 32
    and request_auth_tag ~ '^[A-Za-z0-9+/]+={0,2}$'
  ),
  request_ciphertext text not null check (
    length(request_ciphertext) between 32 and 8192
    and request_ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'
  ),
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'not_found', 'ambiguous', 'failed', 'expired')
  ),
  matched_import_id uuid,
  result_schema smallint check (result_schema is null or result_schema = 1),
  result_iv text check (
    result_iv is null
    or (length(result_iv) between 16 and 24 and result_iv ~ '^[A-Za-z0-9+/]+={0,2}$')
  ),
  result_auth_tag text check (
    result_auth_tag is null
    or (
      length(result_auth_tag) between 20 and 32
      and result_auth_tag ~ '^[A-Za-z0-9+/]+={0,2}$'
    )
  ),
  result_ciphertext text check (
    result_ciphertext is null
    or (
      length(result_ciphertext) between 16 and 8192
      and result_ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'
    )
  ),
  result_count smallint check (result_count is null or result_count between 0 and 2),
  error_code text check (
    error_code is null or error_code ~ '^[a-z][a-z0-9_]{2,63}$'
  ),
  expires_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (matched_import_id, institution_id)
    references public.identity_directory_imports(id, institution_id) on delete restrict,
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  check (
    (status = 'completed' and result_count = 1 and result_schema = 1
      and result_iv is not null and result_auth_tag is not null
      and result_ciphertext is not null and matched_import_id is not null
      and completed_at is not null)
    or
    (status <> 'completed' and result_schema is null and result_iv is null
      and result_auth_tag is null and result_ciphertext is null)
  ),
  check (
    status not in ('not_found', 'ambiguous', 'failed', 'expired')
    or completed_at is not null
  )
);

create index identity_directory_lookup_actor_idx
  on public.identity_directory_lookup_requests (institution_id, actor_id, created_at desc);
create index identity_directory_lookup_expiry_idx
  on public.identity_directory_lookup_requests (expires_at)
  where status in ('queued', 'processing', 'completed');
create index identity_directory_lookup_status_idx
  on public.identity_directory_lookup_requests (status, created_at)
  where status in ('queued', 'processing');

create trigger identity_directory_lookup_requests_set_updated_at
before update on public.identity_directory_lookup_requests
for each row execute function public.support_set_updated_at();

alter table public.identity_directory_lookup_requests enable row level security;
alter table public.identity_directory_lookup_requests force row level security;

revoke all on table public.identity_directory_lookup_requests
from public, anon, authenticated;
grant select, insert, update, delete on table public.identity_directory_lookup_requests
to service_role;

revoke all on table
  pgmq.q_identity_directory_lookup,
  pgmq.a_identity_directory_lookup
from public, anon, authenticated;

alter table public.identity_directory_audit
  drop constraint if exists identity_directory_audit_resource_type_check;
alter table public.identity_directory_audit
  add constraint identity_directory_audit_resource_type_check check (
    resource_type in (
      'import', 'contact_verification', 'identity', 'relationship', 'lookup_request'
    )
  );

alter table public.identity_directory_audit
  drop constraint if exists identity_directory_audit_action_check;
alter table public.identity_directory_audit
  add constraint identity_directory_audit_action_check check (
    action in (
      'reserve_upload', 'confirm_upload', 'reject_upload', 'queue_scan',
      'complete_parse', 'approve', 'activate', 'supersede', 'retire', 'revoke',
      'verify_contact', 'link_identity', 'link_relationship',
      'request_lookup', 'complete_lookup', 'read_lookup', 'expire_lookup'
    )
  );

comment on table public.identity_directory_lookup_requests is
  'Short-lived encrypted exact-match requests. Plain queries and results are forbidden.';
comment on column public.identity_directory_lookup_requests.justification_hash is
  'Audit fingerprint only; the human justification is inside the encrypted request.';

commit;
