begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.identity_directory_lookup_requests
  drop constraint identity_directory_lookup_requests_actor_id_fkey,
  alter column actor_id drop not null,
  add column public_actor_id uuid,
  drop constraint identity_directory_lookup_requests_search_type_check,
  add constraint identity_directory_lookup_requests_search_type_check check (
    search_type in ('academic_email', 'personal_email', 'email', 'phone', 'person_ref')
  ),
  add constraint identity_directory_lookup_requests_actor_shape check (
    (actor_id is not null and public_actor_id is null)
    or (actor_id is null and public_actor_id is not null)
  );

alter table public.identity_directory_lookup_requests
  add constraint identity_directory_lookup_requests_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete restrict;

create index identity_directory_lookup_public_actor_idx
  on public.identity_directory_lookup_requests (institution_id, public_actor_id, created_at desc)
  where public_actor_id is not null;

alter table public.support_rate_limits
  drop constraint support_rate_limits_scope_check;
alter table public.support_rate_limits
  add constraint support_rate_limits_scope_check check (
    scope in (
      'assistant_session', 'assistant_network', 'assistant_global', 'request_network',
      'message_session', 'magic_token_network', 'content_ai_user', 'agent_translation_user',
      'request_device_burst', 'request_device_daily', 'request_contact_burst',
      'request_contact_daily', 'request_behavior_repeat', 'request_invalid_device',
      'attachment_reserve_session', 'attachment_confirm_session', 'attachment_download_session',
      'agent_attachment_download_user', 'agent_write_user',
      'identity_otp_device_burst', 'identity_otp_device_daily',
      'identity_otp_contact_burst', 'identity_otp_contact_daily',
      'identity_otp_network', 'identity_otp_verify_device'
    )
  );

create table public.identity_device_challenges (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  lookup_request_id uuid not null unique references public.identity_directory_lookup_requests(id) on delete cascade,
  device_key_hash text not null check (device_key_hash ~ '^[a-f0-9]{64}$'),
  contact_hash text not null check (contact_hash ~ '^[a-f0-9]{64}$'),
  remember_device boolean not null default false,
  status text not null default 'lookup_queued' check (
    status in ('lookup_queued', 'delivery_pending', 'code_sent', 'verified', 'ineligible', 'failed', 'expired')
  ),
  code_hash text check (code_hash is null or code_hash ~ '^[a-f0-9]{64}$'),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  matched_import_id uuid references public.identity_directory_imports(id) on delete restrict,
  matched_person_ref text,
  matched_person_type text check (
    matched_person_type is null or matched_person_type in ('student', 'guardian', 'staff')
  ),
  expires_at timestamptz not null,
  code_sent_at timestamptz,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_device_challenges_match_shape check (
    (matched_import_id is null and matched_person_ref is null and matched_person_type is null)
    or
    (matched_import_id is not null and matched_person_ref is not null and matched_person_type is not null)
  ),
  constraint identity_device_challenges_code_shape check (
    (status = 'delivery_pending' and code_hash is not null)
    or (status in ('code_sent', 'verified') and code_hash is not null and code_sent_at is not null)
    or status not in ('delivery_pending', 'code_sent', 'verified')
  ),
  constraint identity_device_challenges_ready_shape check (
    status not in ('delivery_pending', 'code_sent', 'verified')
    or (matched_import_id is not null and matched_person_ref is not null and matched_person_type is not null)
  ),
  constraint identity_device_challenges_verified_shape check (
    status <> 'verified' or (verified_at is not null and consumed_at is not null)
  )
);

create index identity_device_challenges_scope_status_idx
  on public.identity_device_challenges (institution_id, status, expires_at);
create index identity_device_challenges_device_idx
  on public.identity_device_challenges (institution_id, device_key_hash, created_at desc);
create index identity_device_challenges_contact_idx
  on public.identity_device_challenges (institution_id, contact_hash, created_at desc);

create table public.identity_device_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  source_import_id uuid not null references public.identity_directory_imports(id) on delete restrict,
  person_ref text not null check (person_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$'),
  person_type text not null check (person_type in ('student', 'guardian', 'staff')),
  session_hash text not null unique check (session_hash ~ '^[a-f0-9]{64}$'),
  assurance_level text not null default 'directory_email_otp' check (
    assurance_level = 'directory_email_otp'
  ),
  persistent boolean not null default false,
  verified_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_device_sessions_time_order check (
    verified_at <= expires_at and last_used_at <= expires_at
    and expires_at <= absolute_expires_at
  )
);

create index identity_device_sessions_active_idx
  on public.identity_device_sessions (institution_id, session_hash, expires_at)
  where revoked_at is null;
create index identity_device_sessions_person_idx
  on public.identity_device_sessions (
    institution_id, source_import_id, person_ref, person_type, expires_at
  )
  where revoked_at is null;

alter table public.identity_device_challenges enable row level security;
alter table public.identity_device_challenges force row level security;
alter table public.identity_device_sessions enable row level security;
alter table public.identity_device_sessions force row level security;

revoke all on table public.identity_device_challenges from public, anon, authenticated;
revoke all on table public.identity_device_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.identity_device_challenges to service_role;
grant select, insert, update, delete on table public.identity_device_sessions to service_role;

create trigger identity_device_challenges_set_updated_at
before update on public.identity_device_challenges
for each row execute function public.support_set_updated_at();

create trigger identity_device_sessions_set_updated_at
before update on public.identity_device_sessions
for each row execute function public.support_set_updated_at();

comment on table public.identity_device_challenges is
  'Server-only, non-enumerating email challenges for school identity device sessions.';
comment on table public.identity_device_sessions is
  'Server-only, revocable device sessions scoped to one active directory identity.';

commit;
