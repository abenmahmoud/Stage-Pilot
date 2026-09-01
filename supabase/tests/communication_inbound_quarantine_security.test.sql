begin;

insert into public.institutions (id, slug, name, status) values
  ('00000000-0000-4000-8000-000000009001', 'inbound-quarantine-a', 'Inbound Quarantine A', 'draft'),
  ('00000000-0000-4000-8000-000000009002', 'inbound-quarantine-b', 'Inbound Quarantine B', 'draft');

insert into public.communication_inbound (
  id, institution_id, communication_id, provider, external_message_hash, status
) values
  (
    '00000000-0000-4000-8000-000000009010',
    '00000000-0000-4000-8000-000000009001',
    null, 'brevo_inbound', repeat('a', 64), 'received'
  ),
  (
    '00000000-0000-4000-8000-000000009011',
    '00000000-0000-4000-8000-000000009002',
    null, 'brevo_inbound', repeat('a', 64), 'received'
  );

insert into public.communication_inbound_objects (
  id, institution_id, inbound_id, object_kind, object_ref_hash,
  media_type, size_bytes, storage_path
) values (
  '00000000-0000-4000-8000-000000009020',
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000009010',
  'attachment', repeat('b', 64), 'application/pdf', 4096,
  'institutions/00000000-0000-4000-8000-000000009001/inbound/00000000-0000-4000-8000-000000009020'
);

insert into public.communication_inbound_object_events (
  institution_id, inbound_object_id, event_type, actor_type, summary
) values (
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000009020',
  'object.reserved', 'provider', '{"objectKind":"attachment","sizeBytes":4096}'::jsonb
);

do $$
declare
  clean_without_proof_blocked boolean := false;
  duplicate_ref_blocked boolean := false;
  cross_scope_blocked boolean := false;
  reverse_transition_blocked boolean := false;
  clean_proof_rewrite_blocked boolean := false;
  identity_rewrite_blocked boolean := false;
  terminal_proof_rewrite_blocked boolean := false;
  unsafe_summary_blocked boolean := false;
  fractional_size_blocked boolean := false;
  state_mismatch_event_blocked boolean := false;
  duplicate_terminal_event_blocked boolean := false;
  event_update_blocked boolean := false;
  error_constraint text;
begin
  begin
    insert into public.communication_inbound_object_events (
      institution_id, inbound_object_id, event_type, actor_type, summary
    ) values (
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009020',
      'object.reserved', 'provider', '{"body":"must-not-be-audited"}'::jsonb
    );
  exception when check_violation then
    get stacked diagnostics error_constraint = constraint_name;
    unsafe_summary_blocked := error_constraint
      = 'communication_inbound_object_events_summary_safe_check';
  end;

  insert into public.communication_inbound_objects (
    id, institution_id, inbound_id, object_kind, object_ref_hash,
    media_type, size_bytes, storage_path
  ) values (
    '00000000-0000-4000-8000-000000009021',
    '00000000-0000-4000-8000-000000009001',
    '00000000-0000-4000-8000-000000009010',
    'attachment', repeat('f', 64), 'application/pdf', 4096,
    'institutions/00000000-0000-4000-8000-000000009001/inbound/00000000-0000-4000-8000-000000009021'
  );

  begin
    insert into public.communication_inbound_object_events (
      institution_id, inbound_object_id, event_type, actor_type, summary
    ) values (
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009021',
      'object.reserved', 'provider',
      '{"objectKind":"attachment","sizeBytes":4096.5}'::jsonb
    );
  exception when check_violation then
    get stacked diagnostics error_constraint = constraint_name;
    fractional_size_blocked := error_constraint
      = 'communication_inbound_object_events_summary_safe_check';
  end;

  if public.communication_inbound_object_event_summary_is_safe(
    'object.reserved', 'provider', null
  ) is distinct from false then
    raise exception 'Inbound quarantine null summary unexpectedly accepted';
  end if;

  begin
    insert into public.communication_inbound_object_events (
      institution_id, inbound_object_id, event_type, actor_type, summary
    ) values (
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009020',
      'object.clean', 'system', '{"antivirus":"clamav_clean"}'::jsonb
    );
  exception when raise_exception then
    state_mismatch_event_blocked := sqlerrm
      = 'communication_inbound_object_event_state_mismatch';
  end;

  begin
    update public.communication_inbound_objects
    set status = 'quarantine', scan_detail = 'awaiting_antivirus',
        sha256 = repeat('a', 64)
    where id = '00000000-0000-4000-8000-000000009021';

    update public.communication_inbound_objects
    set status = 'clean', storage_bucket = 'communication-inbound-clean'
    where id = '00000000-0000-4000-8000-000000009021';
  exception when raise_exception then
    clean_without_proof_blocked := sqlerrm
      = 'communication_inbound_object_clean_proof_required';
  end;

  begin
    insert into public.communication_inbound_objects (
      institution_id, inbound_id, object_kind, object_ref_hash,
      media_type, size_bytes, storage_path
    ) values (
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009010',
      'attachment', repeat('b', 64), 'application/pdf', 1024,
      'institutions/00000000-0000-4000-8000-000000009001/inbound/duplicate-object'
    );
  exception when unique_violation then
    duplicate_ref_blocked := true;
  end;

  begin
    insert into public.communication_inbound_objects (
      institution_id, inbound_id, object_kind, object_ref_hash,
      media_type, size_bytes, storage_path
    ) values (
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009011',
      'message_body', repeat('c', 64), 'text/plain', 128,
      'institutions/00000000-0000-4000-8000-000000009001/inbound/cross-scope-object'
    );
  exception when foreign_key_violation then
    cross_scope_blocked := true;
  end;

  update public.communication_inbound_objects
  set status = 'quarantine', scan_detail = 'awaiting_antivirus', sha256 = repeat('d', 64)
  where id = '00000000-0000-4000-8000-000000009020';

  insert into public.communication_inbound_object_events (
    institution_id, inbound_object_id, event_type, actor_type, summary
  ) values (
    '00000000-0000-4000-8000-000000009001',
    '00000000-0000-4000-8000-000000009020',
    'object.quarantined', 'system', '{"scan":"pending"}'::jsonb
  );

  update public.communication_inbound_objects
  set status = 'clean', storage_bucket = 'communication-inbound-clean',
      scan_detail = 'clamav_clean', scanned_at = transaction_timestamp()
  where id = '00000000-0000-4000-8000-000000009020';

  insert into public.communication_inbound_object_events (
    institution_id, inbound_object_id, event_type, actor_type, summary
  ) values (
    '00000000-0000-4000-8000-000000009001',
    '00000000-0000-4000-8000-000000009020',
    'object.clean', 'system', '{"antivirus":"clamav_clean"}'::jsonb
  );

  begin
    insert into public.communication_inbound_object_events (
      institution_id, inbound_object_id, event_type, actor_type, summary
    ) values (
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009020',
      'object.clean', 'system', '{"antivirus":"clamav_clean"}'::jsonb
    );
  exception when unique_violation then
    get stacked diagnostics error_constraint = constraint_name;
    duplicate_terminal_event_blocked := error_constraint
      = 'communication_inbound_object_events_singleton_uidx';
  end;

  begin
    update public.communication_inbound_objects
    set id = '00000000-0000-4000-8000-000000009099'
    where id = '00000000-0000-4000-8000-000000009020';
  exception when raise_exception then
    identity_rewrite_blocked := sqlerrm
      = 'communication_inbound_object_identity_immutable';
  end;

  begin
    update public.communication_inbound_objects
    set sha256 = repeat('e', 64), scanned_at = transaction_timestamp()
    where id = '00000000-0000-4000-8000-000000009020';
  exception when raise_exception then
    clean_proof_rewrite_blocked := sqlerrm
      = 'communication_inbound_object_proof_immutable';
  end;

  begin
    update public.communication_inbound_objects
    set status = 'purged', scan_detail = 'purged_without_proof'
    where id = '00000000-0000-4000-8000-000000009020';
  exception when raise_exception then
    terminal_proof_rewrite_blocked := sqlerrm
      = 'communication_inbound_object_terminal_proof_immutable';
  end;

  begin
    update public.communication_inbound_objects
    set status = 'quarantine', storage_bucket = 'communication-inbound-quarantine',
        scan_detail = 'awaiting_antivirus', scanned_at = null
    where id = '00000000-0000-4000-8000-000000009020';
  exception when raise_exception then
    reverse_transition_blocked := sqlerrm
      = 'invalid_communication_inbound_object_transition';
  end;

  begin
    update public.communication_inbound_object_events
    set summary = '{"changed":true}'::jsonb
    where inbound_object_id = '00000000-0000-4000-8000-000000009020';
  exception when raise_exception then
    event_update_blocked := sqlerrm = 'Communication events are append-only';
  end;

  if not clean_without_proof_blocked
    or not duplicate_ref_blocked
    or not cross_scope_blocked
    or not reverse_transition_blocked
    or not clean_proof_rewrite_blocked
    or not identity_rewrite_blocked
    or not terminal_proof_rewrite_blocked
    or not unsafe_summary_blocked
    or not fractional_size_blocked
    or not state_mismatch_event_blocked
    or not duplicate_terminal_event_blocked
    or not event_update_blocked then
    raise exception 'Inbound quarantine guard failed';
  end if;

  if (select status from public.communication_inbound_objects
      where id = '00000000-0000-4000-8000-000000009020') <> 'clean'
    or (select storage_bucket from public.communication_inbound_objects
        where id = '00000000-0000-4000-8000-000000009020') <> 'communication-inbound-clean'
    or (select count(*) from public.communication_inbound_object_events
        where inbound_object_id = '00000000-0000-4000-8000-000000009020') <> 3 then
    raise exception 'Inbound quarantine lifecycle invariant failed';
  end if;

  if exists (
    select 1
    from (values
      ('anon', 'public.communication_inbound_objects'),
      ('anon', 'public.communication_inbound_object_events'),
      ('authenticated', 'public.communication_inbound_objects'),
      ('authenticated', 'public.communication_inbound_object_events'),
      ('anon', 'pgmq.q_communication_inbound_scan'),
      ('authenticated', 'pgmq.q_communication_inbound_scan')
    ) as client_tables(role_name, table_name)
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as privileges(privilege_name)
    where has_table_privilege(role_name, table_name, privilege_name)
  ) then
    raise exception 'Client role unexpectedly has inbound quarantine privileges';
  end if;

  if exists (
    select 1 from storage.buckets
    where id in ('communication-inbound-quarantine', 'communication-inbound-clean')
      and public
  ) or (select count(*) from storage.buckets
        where id in ('communication-inbound-quarantine', 'communication-inbound-clean')) <> 2 then
    raise exception 'Inbound communication buckets are not both private';
  end if;
end
$$;

rollback;

select
  (select count(*) from public.institutions
   where id in (
     '00000000-0000-4000-8000-000000009001',
     '00000000-0000-4000-8000-000000009002'
   )) as institution_residue,
  (select count(*) from public.communication_inbound
   where id in (
     '00000000-0000-4000-8000-000000009010',
     '00000000-0000-4000-8000-000000009011'
   )) as inbound_residue,
  (select count(*) from public.communication_inbound_objects
   where id = '00000000-0000-4000-8000-000000009020') as object_residue,
  (select count(*) from public.communication_inbound_object_events
   where inbound_object_id = '00000000-0000-4000-8000-000000009020') as event_residue,
  (select count(*) from pgmq.q_communication_inbound_scan) as queue_residue;
