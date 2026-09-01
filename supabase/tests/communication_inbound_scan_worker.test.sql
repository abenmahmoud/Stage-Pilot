-- Preview only. Synthetic metadata, no storage access; every change is rolled back.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '10s';

insert into public.institutions (id, slug, name, status) values (
  '00000000-0000-4000-8000-000000009401', 'inbound-scan-worker-test', 'Fictional Scan Worker', 'draft'
);
insert into public.communication_inbound (
  id, institution_id, provider, external_message_hash, status
) values (
  '00000000-0000-4000-8000-000000009410', '00000000-0000-4000-8000-000000009401',
  'brevo_inbound', repeat('a', 64), 'received'
);

do $$
declare
  institution constant uuid := '00000000-0000-4000-8000-000000009401';
  inbound constant uuid := '00000000-0000-4000-8000-000000009410';
  object_id uuid;
  payload jsonb;
  lease record;
  job_id bigint;
  affected integer;
begin
  for n in 20..22 loop
    object_id := ('00000000-0000-4000-8000-0000000094' || n::text)::uuid;
    insert into public.communication_inbound_objects (
      id, institution_id, inbound_id, object_kind, object_ref_hash, media_type, size_bytes, storage_path
    ) values (
      object_id, institution, inbound, 'attachment', lpad(n::text, 64, '0'), 'text/plain', 32,
      format('institutions/%s/inbound/%s/objects/%s', institution, inbound, object_id)
    );
    insert into public.communication_inbound_object_events (
      institution_id, inbound_object_id, actor_type, event_type, summary
    ) values (institution, object_id, 'provider', 'object.reserved', '{"objectKind":"attachment","sizeBytes":32}');
    update public.communication_inbound_objects
      set status = 'quarantine', scan_detail = 'awaiting_antivirus', sha256 = repeat('b', 64)
      where id = object_id and institution_id = institution and inbound_id = inbound;
    insert into public.communication_inbound_object_events (
      institution_id, inbound_object_id, actor_type, event_type, summary
    ) values (institution, object_id, 'system', 'object.quarantined', '{"scan":"pending"}');

    payload := jsonb_build_object('schema', 1, 'job_type', 'scan_communication_inbound_object',
      'institution_id', institution, 'inbound_id', inbound, 'object_id', object_id);
    select pgmq.send('communication_inbound_scan', payload) into job_id;
    -- Conditional read never leases an unrelated queued message.
    select * into strict lease from pgmq.read('communication_inbound_scan', 300, 1, payload);
    if lease.msg_id <> job_id or lease.read_ct <> 1 then raise exception 'Unexpected synthetic lease'; end if;
    perform 1 from pgmq.q_communication_inbound_scan
      where msg_id = job_id and read_ct = lease.read_ct and vt > clock_timestamp() for update;
    if not found then raise exception 'Current lease was not lockable'; end if;
    perform 1 from pgmq.q_communication_inbound_scan
      where msg_id = job_id and read_ct = lease.read_ct + 1 and vt > clock_timestamp() for update;
    if found then raise exception 'Stale lease was accepted'; end if;
    perform 1 from public.communication_inbound_objects
      where id = object_id and institution_id = institution and inbound_id = inbound for update;
    if not found then raise exception 'Scoped object was not lockable'; end if;
    update public.communication_inbound_objects set scan_detail = 'must_not_write'
      where id = object_id and institution_id = '00000000-0000-4000-8000-000000009499' and inbound_id = inbound;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Foreign scope was writable'; end if;

    if n = 20 then
      begin
        update public.communication_inbound_objects
          set status = 'clean', scan_detail = 'clamav_clean', scanned_at = clock_timestamp(),
            storage_bucket = 'communication-inbound-clean'
          where id = object_id and institution_id = institution and inbound_id = inbound;
        insert into public.communication_inbound_object_events (
          institution_id, inbound_object_id, actor_type, event_type, summary
        ) values (institution, object_id, 'system', 'object.clean', '{"antivirus":"clamav_clean"}');
        if not pgmq.delete('communication_inbound_scan', job_id) then raise exception 'Synthetic ack failed'; end if;
        raise exception 'forced_scan_worker_rollback';
      exception when raise_exception then
        if sqlerrm <> 'forced_scan_worker_rollback' then raise; end if;
      end;
      if (select status from public.communication_inbound_objects where id = object_id) <> 'quarantine'
        or not exists (select 1 from pgmq.q_communication_inbound_scan where msg_id = job_id)
        or exists (select 1 from public.communication_inbound_object_events
          where inbound_object_id = object_id and event_type = 'object.clean') then
        raise exception 'State, event and acknowledgement were not rolled back together';
      end if;
      update public.communication_inbound_objects
        set status = 'clean', scan_detail = 'clamav_clean', scanned_at = clock_timestamp(),
          storage_bucket = 'communication-inbound-clean'
        where id = object_id and institution_id = institution and inbound_id = inbound;
      insert into public.communication_inbound_object_events (
        institution_id, inbound_object_id, actor_type, event_type, summary
      ) values (institution, object_id, 'system', 'object.clean', '{"antivirus":"clamav_clean"}');
      if not pgmq.delete('communication_inbound_scan', job_id) then raise exception 'Synthetic clean ack failed'; end if;
      if pgmq.delete('communication_inbound_scan', job_id) then raise exception 'Repeated ack unexpectedly succeeded'; end if;
    elsif n = 21 then
      update public.communication_inbound_objects
        set status = 'blocked', scan_detail = 'antivirus_detected_threat', scanned_at = clock_timestamp()
        where id = object_id and institution_id = institution and inbound_id = inbound;
      insert into public.communication_inbound_object_events (
        institution_id, inbound_object_id, actor_type, event_type, summary
      ) values (institution, object_id, 'system', 'object.blocked', '{"reason":"antivirus_detected_threat"}');
      if not pgmq.delete('communication_inbound_scan', job_id) then raise exception 'Synthetic blocked ack failed'; end if;
      if (select storage_bucket from public.communication_inbound_objects where id = object_id)
        <> 'communication-inbound-quarantine' then raise exception 'Blocked object left quarantine'; end if;
    else
      update public.communication_inbound_objects
        set status = 'scan_error', scan_detail = 'scan_timeout', scanned_at = null
        where id = object_id and institution_id = institution and inbound_id = inbound;
      insert into public.communication_inbound_object_events (
        institution_id, inbound_object_id, actor_type, event_type, summary
      ) values (institution, object_id, 'system', 'object.scan_error', '{"reason":"scan_timeout","attempt":1}');
      perform msg_id from pgmq.set_vt('communication_inbound_scan', job_id, 30);
      if not found then raise exception 'Retry lost its message'; end if;
      if exists (select 1 from pgmq.read('communication_inbound_scan', 300, 1, payload)) then
        raise exception 'Retry was visible before its delay';
      end if;
      perform msg_id from pgmq.set_vt('communication_inbound_scan', job_id, 0);
      select * into strict lease from pgmq.read('communication_inbound_scan', 300, 1, payload);
      if lease.read_ct <> 2 then raise exception 'Retry did not increment read count'; end if;
      update public.communication_inbound_objects
        set status = 'quarantine', scan_detail = 'awaiting_antivirus', scanned_at = null
        where id = object_id and institution_id = institution and inbound_id = inbound;
      insert into public.communication_inbound_object_events (
        institution_id, inbound_object_id, actor_type, event_type, summary
      ) values (institution, object_id, 'system', 'object.quarantined', '{"scan":"pending"}');
      update public.communication_inbound_objects
        set status = 'scan_error', scan_detail = 'unsupported_media', scanned_at = null
        where id = object_id and institution_id = institution and inbound_id = inbound;
      insert into public.communication_inbound_object_events (
        institution_id, inbound_object_id, actor_type, event_type, summary
      ) values (institution, object_id, 'system', 'object.scan_error', '{"reason":"unsupported_media","attempt":2}');
      if not pgmq.archive('communication_inbound_scan', job_id) then raise exception 'Archival failed'; end if;
      if exists (select 1 from pgmq.q_communication_inbound_scan where msg_id = job_id)
        or not exists (select 1 from pgmq.a_communication_inbound_scan where msg_id = job_id and message = payload) then
        raise exception 'Archival lost its evidence';
      end if;
    end if;
  end loop;
end
$$;

rollback;

select
  (select count(*) from public.institutions where id = '00000000-0000-4000-8000-000000009401') as institution_residue,
  (select count(*) from public.communication_inbound where id = '00000000-0000-4000-8000-000000009410') as inbound_residue,
  (select count(*) from public.communication_inbound_objects where institution_id = '00000000-0000-4000-8000-000000009401') as object_residue,
  (select count(*) from public.communication_inbound_object_events where institution_id = '00000000-0000-4000-8000-000000009401') as event_residue,
  (select count(*) from pgmq.q_communication_inbound_scan where message ->> 'institution_id' = '00000000-0000-4000-8000-000000009401') as queue_residue,
  (select count(*) from pgmq.a_communication_inbound_scan where message ->> 'institution_id' = '00000000-0000-4000-8000-000000009401') as archive_residue;
