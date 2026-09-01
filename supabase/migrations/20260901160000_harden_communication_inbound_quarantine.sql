begin;

create or replace function public.communication_inbound_object_event_summary_is_safe(
  event_type_value text,
  actor_type_value text,
  summary_value jsonb
)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
begin
  if jsonb_typeof(summary_value) <> 'object'
    or pg_column_size(summary_value) > 1024 then
    return false;
  end if;

  if event_type_value = 'object.reserved' then
    return coalesce(
      actor_type_value in ('provider', 'system')
      and jsonb_object_length(summary_value) = 2
      and summary_value ? 'objectKind'
      and summary_value ? 'sizeBytes'
      and jsonb_typeof(summary_value -> 'objectKind') = 'string'
      and summary_value ->> 'objectKind' in ('message_body', 'attachment')
      and jsonb_typeof(summary_value -> 'sizeBytes') = 'number'
      and (summary_value ->> 'sizeBytes')::numeric between 1 and 10485760,
      false
    );
  end if;

  if actor_type_value <> 'system' then
    return false;
  end if;

  if event_type_value = 'object.quarantined' then
    return coalesce(
      summary_value = '{"scan":"pending"}'::jsonb,
      false
    );
  end if;

  if event_type_value = 'object.clean' then
    return coalesce(
      summary_value = '{"antivirus":"clamav_clean"}'::jsonb,
      false
    );
  end if;

  if event_type_value = 'object.blocked' then
    return coalesce(
      summary_value = '{"reason":"antivirus_detected_threat"}'::jsonb,
      false
    );
  end if;

  if event_type_value = 'object.scan_error' then
    return coalesce(
      jsonb_object_length(summary_value) = 2
      and summary_value ? 'reason'
      and summary_value ? 'attempt'
      and jsonb_typeof(summary_value -> 'reason') = 'string'
      and summary_value ->> 'reason' in (
        'scanner_unavailable', 'scan_timeout', 'storage_read_failed',
        'digest_mismatch', 'unsafe_archive', 'unsupported_media'
      )
      and jsonb_typeof(summary_value -> 'attempt') = 'number'
      and (summary_value ->> 'attempt')::numeric between 1 and 5
      and trunc((summary_value ->> 'attempt')::numeric)
        = (summary_value ->> 'attempt')::numeric,
      false
    );
  end if;

  if event_type_value = 'object.purged' then
    return coalesce(
      jsonb_object_length(summary_value) = 1
      and jsonb_typeof(summary_value -> 'reason') = 'string'
      and summary_value ->> 'reason' in (
        'retention_expired', 'security_purge', 'test_cleanup'
      ),
      false
    );
  end if;

  return false;
end;
$$;

alter table public.communication_inbound_object_events
  add constraint communication_inbound_object_events_summary_safe_check
  check (
    public.communication_inbound_object_event_summary_is_safe(
      event_type,
      actor_type,
      summary
    )
  );

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

  if old.status = new.status then
    if new.storage_bucket is distinct from old.storage_bucket
      or new.scan_detail is distinct from old.scan_detail
      or new.sha256 is distinct from old.sha256
      or new.scanned_at is distinct from old.scanned_at then
      raise exception 'communication_inbound_object_proof_immutable';
    end if;
    return new;
  end if;

  if new.status = 'clean' and not (
    old.status = 'quarantine'
    and new.storage_bucket = 'communication-inbound-clean'
    and new.scan_detail = 'clamav_clean'
    and new.sha256 is not null
    and new.scanned_at is not null
  ) then
    raise exception 'communication_inbound_object_clean_proof_required';
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

create or replace function public.communication_inbound_object_event_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  object_status text;
  expected_event_type text;
begin
  select status
  into object_status
  from public.communication_inbound_objects
  where id = new.inbound_object_id
    and institution_id = new.institution_id;

  if not found then
    raise exception 'communication_inbound_object_event_parent_missing';
  end if;

  expected_event_type := case object_status
    when 'reserved' then 'object.reserved'
    when 'quarantine' then 'object.quarantined'
    when 'clean' then 'object.clean'
    when 'blocked' then 'object.blocked'
    when 'scan_error' then 'object.scan_error'
    when 'purged' then 'object.purged'
    else null
  end;

  if new.event_type <> expected_event_type then
    raise exception 'communication_inbound_object_event_state_mismatch';
  end if;

  return new;
end;
$$;

create trigger communication_inbound_object_events_insert_guard_trigger
before insert on public.communication_inbound_object_events
for each row execute function public.communication_inbound_object_event_insert_guard();

revoke all on function public.communication_inbound_object_event_summary_is_safe(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.communication_inbound_object_event_insert_guard()
  from public, anon, authenticated;

comment on constraint communication_inbound_object_events_summary_safe_check
  on public.communication_inbound_object_events is
  'Allows only exact bounded machine summaries; user content and provider prose are rejected.';

commit;
