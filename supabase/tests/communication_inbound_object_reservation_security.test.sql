begin;

insert into public.institutions (id, slug, name, status) values (
  '00000000-0000-4000-8000-000000009101',
  'inbound-object-reservation',
  'Inbound Object Reservation',
  'draft'
);

insert into public.communication_inbound (
  id, institution_id, communication_id, provider, external_message_hash, status
) values (
  '00000000-0000-4000-8000-000000009110',
  '00000000-0000-4000-8000-000000009101',
  null,
  'brevo_inbound',
  repeat('a', 64),
  'received'
);

insert into public.communication_inbound_objects (
  id, institution_id, inbound_id, object_kind, object_ref_hash,
  media_type, size_bytes, storage_path
) values
  (
    '00000000-0000-4000-8000-000000009120',
    '00000000-0000-4000-8000-000000009101',
    '00000000-0000-4000-8000-000000009110',
    'attachment', repeat('b', 64), 'application/pdf', 4096,
    'institutions/00000000-0000-4000-8000-000000009101/inbound/00000000-0000-4000-8000-000000009110/objects/00000000-0000-4000-8000-000000009120'
  ),
  (
    '00000000-0000-4000-8000-000000009121',
    '00000000-0000-4000-8000-000000009101',
    '00000000-0000-4000-8000-000000009110',
    'message_body', repeat('c', 64), 'text/plain', 128,
    'institutions/00000000-0000-4000-8000-000000009101/inbound/00000000-0000-4000-8000-000000009110/objects/00000000-0000-4000-8000-000000009121'
  );

insert into public.communication_inbound_object_events (
  institution_id, inbound_object_id, event_type, actor_type, summary
) values
  (
    '00000000-0000-4000-8000-000000009101',
    '00000000-0000-4000-8000-000000009120',
    'object.reserved', 'provider',
    '{"objectKind":"attachment","sizeBytes":4096}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000009101',
    '00000000-0000-4000-8000-000000009121',
    'object.reserved', 'provider',
    '{"objectKind":"message_body","sizeBytes":128}'::jsonb
  );

do $$
declare
  affected_rows integer;
  rollback_proven boolean := false;
begin
  insert into public.communication_inbound_objects (
    institution_id, inbound_id, object_kind, object_ref_hash,
    media_type, size_bytes, storage_path
  ) values (
    '00000000-0000-4000-8000-000000009101',
    '00000000-0000-4000-8000-000000009110',
    'attachment', repeat('b', 64), 'application/pdf', 4096,
    'institutions/00000000-0000-4000-8000-000000009101/inbound/replay-must-not-exist'
  ) on conflict do nothing;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Inbound object reservation replay created a duplicate';
  end if;

  update public.communication_inbound_objects
  set status = 'quarantine', scan_detail = 'awaiting_antivirus',
      sha256 = repeat('d', 64)
  where id = '00000000-0000-4000-8000-000000009120'
    and institution_id = '00000000-0000-4000-8000-000000009101'
    and inbound_id = '00000000-0000-4000-8000-000000009110'
    and media_type = 'application/pdf'
    and size_bytes = 4096
    and status = 'reserved';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Inbound object quarantine transition was not unique';
  end if;

  insert into public.communication_inbound_object_events (
    institution_id, inbound_object_id, event_type, actor_type, summary
  ) values (
    '00000000-0000-4000-8000-000000009101',
    '00000000-0000-4000-8000-000000009120',
    'object.quarantined', 'system', '{"scan":"pending"}'::jsonb
  );
  perform pgmq.send(
    'communication_inbound_scan',
    jsonb_build_object(
      'schema', 1,
      'job_type', 'scan_communication_inbound_object',
      'institution_id', '00000000-0000-4000-8000-000000009101'::uuid,
      'inbound_id', '00000000-0000-4000-8000-000000009110'::uuid,
      'object_id', '00000000-0000-4000-8000-000000009120'::uuid
    )
  );

  update public.communication_inbound_objects
  set status = 'quarantine', scan_detail = 'awaiting_antivirus',
      sha256 = repeat('d', 64)
  where id = '00000000-0000-4000-8000-000000009120'
    and status = 'reserved';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Inbound object quarantine replay changed state twice';
  end if;

  begin
    update public.communication_inbound_objects
    set status = 'quarantine', scan_detail = 'awaiting_antivirus',
        sha256 = repeat('e', 64)
    where id = '00000000-0000-4000-8000-000000009121'
      and status = 'reserved';
    insert into public.communication_inbound_object_events (
      institution_id, inbound_object_id, event_type, actor_type, summary
    ) values (
      '00000000-0000-4000-8000-000000009101',
      '00000000-0000-4000-8000-000000009121',
      'object.quarantined', 'system', '{"scan":"pending"}'::jsonb
    );
    perform pgmq.send(
      'communication_inbound_scan',
      jsonb_build_object(
        'schema', 1,
        'job_type', 'scan_communication_inbound_object',
        'institution_id', '00000000-0000-4000-8000-000000009101'::uuid,
        'inbound_id', '00000000-0000-4000-8000-000000009110'::uuid,
        'object_id', '00000000-0000-4000-8000-000000009121'::uuid
      )
    );
    raise exception 'forced_inbound_quarantine_rollback';
  exception when raise_exception then
    if sqlerrm <> 'forced_inbound_quarantine_rollback' then
      raise;
    end if;
    rollback_proven := true;
  end;

  if not rollback_proven
    or (select status from public.communication_inbound_objects
        where id = '00000000-0000-4000-8000-000000009121') <> 'reserved'
    or (select count(*) from public.communication_inbound_object_events
        where inbound_object_id = '00000000-0000-4000-8000-000000009121') <> 1 then
    raise exception 'Inbound quarantine rollback did not restore reservation';
  end if;

  if (select count(*) from pgmq.q_communication_inbound_scan
      where message ->> 'object_id' in (
        '00000000-0000-4000-8000-000000009120',
        '00000000-0000-4000-8000-000000009121'
      )) <> 1 then
    raise exception 'Inbound antivirus queue is not idempotent and atomic';
  end if;

  if not exists (
    select 1
    from pgmq.q_communication_inbound_scan
    where message = jsonb_build_object(
      'schema', 1,
      'job_type', 'scan_communication_inbound_object',
      'institution_id', '00000000-0000-4000-8000-000000009101'::uuid,
      'inbound_id', '00000000-0000-4000-8000-000000009110'::uuid,
      'object_id', '00000000-0000-4000-8000-000000009120'::uuid
    )
  ) then
    raise exception 'Inbound antivirus queue payload is not minimal';
  end if;

  if exists (
    select 1
    from pgmq.q_communication_inbound_scan
    where message ?| array[
      'storage_path', 'storage_bucket', 'download_token', 'original_name',
      'sender', 'recipient', 'subject', 'body', 'email'
    ]
  ) then
    raise exception 'Inbound antivirus queue contains forbidden content';
  end if;
end
$$;

rollback;

select
  (select count(*) from public.institutions
   where id = '00000000-0000-4000-8000-000000009101') as institution_residue,
  (select count(*) from public.communication_inbound
   where id = '00000000-0000-4000-8000-000000009110') as inbound_residue,
  (select count(*) from public.communication_inbound_objects
   where id in (
     '00000000-0000-4000-8000-000000009120',
     '00000000-0000-4000-8000-000000009121'
   )) as object_residue,
  (select count(*) from public.communication_inbound_object_events
   where inbound_object_id in (
     '00000000-0000-4000-8000-000000009120',
     '00000000-0000-4000-8000-000000009121'
   )) as event_residue,
  (select count(*) from pgmq.q_communication_inbound_scan
   where message ->> 'object_id' in (
     '00000000-0000-4000-8000-000000009120',
     '00000000-0000-4000-8000-000000009121'
   )) as queue_residue;
