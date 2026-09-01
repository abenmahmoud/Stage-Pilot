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
declare
  summary_key_count integer;
begin
  if jsonb_typeof(summary_value) <> 'object'
    or pg_column_size(summary_value) > 1024 then
    return false;
  end if;

  select count(*)::integer
  into summary_key_count
  from pg_catalog.jsonb_object_keys(summary_value);

  if event_type_value = 'object.reserved' then
    return coalesce(
      actor_type_value in ('provider', 'system')
      and summary_key_count = 2
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
      summary_key_count = 2
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
      summary_key_count = 1
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

comment on function public.communication_inbound_object_event_summary_is_safe(text, text, jsonb) is
  'Validates exact bounded machine-only inbound object events on the preview-compatible PostgreSQL runtime.';

commit;
