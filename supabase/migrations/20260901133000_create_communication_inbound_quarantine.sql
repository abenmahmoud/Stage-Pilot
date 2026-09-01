begin;

create table public.communication_inbound_objects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  inbound_id uuid not null,
  object_kind text not null check (object_kind in ('message_body', 'attachment')),
  object_ref_hash text not null check (object_ref_hash ~ '^[a-f0-9]{64}$'),
  media_type text not null check (
    media_type in (
      'message/rfc822',
      'text/plain',
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )
  ),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  storage_bucket text not null default 'communication-inbound-quarantine' check (
    storage_bucket in ('communication-inbound-quarantine', 'communication-inbound-clean')
  ),
  storage_path text not null unique check (
    length(storage_path) between 20 and 500
    and position('@' in storage_path) = 0
    and storage_path !~ '[[:cntrl:]]'
  ),
  status text not null default 'reserved' check (
    status in ('reserved', 'quarantine', 'clean', 'blocked', 'scan_error', 'purged')
  ),
  scan_detail text check (
    scan_detail is null or scan_detail ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  scanned_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  foreign key (inbound_id, institution_id)
    references public.communication_inbound(id, institution_id) on delete restrict,
  check (
    (status = 'reserved'
      and storage_bucket = 'communication-inbound-quarantine'
      and scan_detail is null and sha256 is null and scanned_at is null)
    or (status = 'quarantine'
      and storage_bucket = 'communication-inbound-quarantine'
      and scan_detail = 'awaiting_antivirus' and sha256 is not null and scanned_at is null)
    or (status = 'clean'
      and storage_bucket = 'communication-inbound-clean'
      and scan_detail = 'clamav_clean' and sha256 is not null and scanned_at is not null)
    or (status = 'blocked'
      and storage_bucket = 'communication-inbound-quarantine'
      and scan_detail = 'antivirus_detected_threat' and sha256 is not null and scanned_at is not null)
    or (status = 'scan_error'
      and storage_bucket = 'communication-inbound-quarantine'
      and scan_detail is not null)
    or status = 'purged'
  )
);

create unique index communication_inbound_objects_scope_ref_uidx
  on public.communication_inbound_objects (institution_id, inbound_id, object_ref_hash);
create index communication_inbound_objects_scope_status_idx
  on public.communication_inbound_objects (institution_id, status, created_at desc);
create index communication_inbound_objects_inbound_scope_fk_idx
  on public.communication_inbound_objects (inbound_id, institution_id, created_at);

create table public.communication_inbound_object_events (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  inbound_object_id uuid not null,
  event_type text not null check (
    event_type in (
      'object.reserved', 'object.quarantined', 'object.clean',
      'object.blocked', 'object.scan_error', 'object.purged'
    )
  ),
  actor_type text not null check (actor_type in ('provider', 'system')),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default transaction_timestamp(),
  foreign key (inbound_object_id, institution_id)
    references public.communication_inbound_objects(id, institution_id) on delete restrict
);

create index communication_inbound_object_events_object_scope_idx
  on public.communication_inbound_object_events
    (inbound_object_id, institution_id, created_at desc);
create index communication_inbound_object_events_scope_created_idx
  on public.communication_inbound_object_events (institution_id, created_at desc);

create or replace function public.communication_inbound_object_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'reserved'
    or new.storage_bucket <> 'communication-inbound-quarantine'
    or new.scan_detail is not null
    or new.sha256 is not null
    or new.scanned_at is not null then
    raise exception 'communication_inbound_object_must_start_reserved';
  end if;
  return new;
end;
$$;

create or replace function public.communication_inbound_object_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.inbound_id <> old.inbound_id
    or new.object_kind <> old.object_kind
    or new.object_ref_hash <> old.object_ref_hash
    or new.media_type <> old.media_type
    or new.size_bytes <> old.size_bytes
    or new.storage_path <> old.storage_path
    or new.created_at <> old.created_at then
    raise exception 'communication_inbound_object_identity_immutable';
  end if;

  if new.status = 'clean' and old.status <> 'clean' and not (
    old.status = 'quarantine'
    and new.storage_bucket = 'communication-inbound-clean'
    and new.scan_detail = 'clamav_clean'
    and new.sha256 is not null
    and new.scanned_at is not null
  ) then
    raise exception 'communication_inbound_object_clean_proof_required';
  end if;

  if old.status = new.status then
    return new;
  end if;
  if not (
    (old.status = 'reserved' and new.status in ('quarantine', 'blocked', 'scan_error', 'purged'))
    or (old.status = 'quarantine' and new.status in ('clean', 'blocked', 'scan_error', 'purged'))
    or (old.status = 'scan_error' and new.status in ('quarantine', 'blocked', 'purged'))
    or (old.status in ('clean', 'blocked') and new.status = 'purged')
  ) then
    raise exception 'invalid_communication_inbound_object_transition';
  end if;
  return new;
end;
$$;

create trigger communication_inbound_objects_insert_guard_trigger
before insert on public.communication_inbound_objects
for each row execute function public.communication_inbound_object_insert_guard();
create trigger communication_inbound_objects_guard_trigger
before update on public.communication_inbound_objects
for each row execute function public.communication_inbound_object_guard();
create trigger communication_inbound_objects_set_updated_at_trigger
before update on public.communication_inbound_objects
for each row execute function public.communication_set_updated_at();
create trigger communication_inbound_object_events_append_only_trigger
before update or delete on public.communication_inbound_object_events
for each row execute function public.communication_events_append_only();

alter table public.communication_inbound_objects enable row level security;
alter table public.communication_inbound_objects force row level security;
alter table public.communication_inbound_object_events enable row level security;
alter table public.communication_inbound_object_events force row level security;
revoke all on table public.communication_inbound_objects from public, anon, authenticated;
revoke all on table public.communication_inbound_object_events from public, anon, authenticated;
revoke all on sequence public.communication_inbound_object_events_id_seq from public, anon, authenticated;
revoke all on function public.communication_inbound_object_insert_guard() from public, anon, authenticated;
revoke all on function public.communication_inbound_object_guard() from public, anon, authenticated;
grant select, insert, update on table public.communication_inbound_objects to service_role;
grant select, insert on table public.communication_inbound_object_events to service_role;
grant usage, select on sequence public.communication_inbound_object_events_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'communication-inbound-quarantine',
    'communication-inbound-quarantine',
    false,
    10485760,
    array[
      'message/rfc822', 'text/plain', 'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
  ),
  (
    'communication-inbound-clean',
    'communication-inbound-clean',
    false,
    10485760,
    array[
      'message/rfc822', 'text/plain', 'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

select pgmq.create('communication_inbound_scan');
alter table pgmq.q_communication_inbound_scan enable row level security;
alter table pgmq.q_communication_inbound_scan force row level security;
alter table pgmq.a_communication_inbound_scan enable row level security;
alter table pgmq.a_communication_inbound_scan force row level security;
revoke all on table
  pgmq.q_communication_inbound_scan,
  pgmq.a_communication_inbound_scan
from public, anon, authenticated;

comment on table public.communication_inbound_objects is
  'Opaque private objects for inbound messages. No sender, recipient, subject, body or original filename is stored here.';
comment on column public.communication_inbound_objects.object_ref_hash is
  'Institution-scoped HMAC used for idempotency; never a provider token or address.';
comment on column public.communication_inbound_objects.scan_detail is
  'Closed machine code only; never antivirus output or user content.';
comment on table pgmq.q_communication_inbound_scan is
  'Private queue for local antivirus of inbound communication objects.';

commit;
