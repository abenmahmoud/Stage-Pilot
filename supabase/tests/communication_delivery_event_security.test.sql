begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000008001',
  'authenticated', 'authenticated', 'communication-delivery-event@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"fixture":true}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.institutions (id, slug, name, status) values
  ('00000000-0000-4000-8000-000000008002', 'delivery-event-a', 'Delivery Event A', 'draft'),
  ('00000000-0000-4000-8000-000000008003', 'delivery-event-b', 'Delivery Event B', 'draft');

insert into public.communication_settings (
  institution_id, module_enabled, sending_enabled, updated_by
) values
  ('00000000-0000-4000-8000-000000008002', true, true, '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008003', true, true, '00000000-0000-4000-8000-000000008001');

insert into public.communications (
  id, institution_id, source_type, source_fingerprint, source_label,
  created_by
) values
  (
    '00000000-0000-4000-8000-000000008010',
    '00000000-0000-4000-8000-000000008002',
    'direct_text', repeat('1', 64), 'Communication fictive A',
    '00000000-0000-4000-8000-000000008001'
  ),
  (
    '00000000-0000-4000-8000-000000008011',
    '00000000-0000-4000-8000-000000008003',
    'direct_text', repeat('2', 64), 'Communication fictive B',
    '00000000-0000-4000-8000-000000008001'
  );

insert into public.communication_versions (
  id, institution_id, communication_id, version, title,
  body_markdown, content_hash, created_by
) values
  (
    '00000000-0000-4000-8000-000000008020',
    '00000000-0000-4000-8000-000000008002',
    '00000000-0000-4000-8000-000000008010', 1,
    'Message fictif A', 'Contenu fictif A.', repeat('3', 64),
    '00000000-0000-4000-8000-000000008001'
  ),
  (
    '00000000-0000-4000-8000-000000008021',
    '00000000-0000-4000-8000-000000008003',
    '00000000-0000-4000-8000-000000008011', 1,
    'Message fictif B', 'Contenu fictif B.', repeat('4', 64),
    '00000000-0000-4000-8000-000000008001'
  );

update public.communication_versions
set status = 'review'
where id in (
  '00000000-0000-4000-8000-000000008020',
  '00000000-0000-4000-8000-000000008021'
);

update public.communications
set status = 'review'
where id in (
  '00000000-0000-4000-8000-000000008010',
  '00000000-0000-4000-8000-000000008011'
);

update public.communication_versions
set status = 'approved',
    approved_by = '00000000-0000-4000-8000-000000008001',
    approved_at = transaction_timestamp()
where id in (
  '00000000-0000-4000-8000-000000008020',
  '00000000-0000-4000-8000-000000008021'
);

update public.communications
set status = 'approved',
    approved_by = '00000000-0000-4000-8000-000000008001',
    approved_at = transaction_timestamp()
where id in (
  '00000000-0000-4000-8000-000000008010',
  '00000000-0000-4000-8000-000000008011'
);

insert into public.communication_deliveries (
  id, institution_id, communication_id, version_id, version, contact_ref,
  status, idempotency_key_hash, provider_message_ref, sent_at
) values
  (
    '00000000-0000-4000-8000-000000008030',
    '00000000-0000-4000-8000-000000008002',
    '00000000-0000-4000-8000-000000008010',
    '00000000-0000-4000-8000-000000008020', 1,
    'contact:fictive:delivery:a', 'sent', repeat('5', 64), repeat('a', 64),
    transaction_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000008031',
    '00000000-0000-4000-8000-000000008003',
    '00000000-0000-4000-8000-000000008011',
    '00000000-0000-4000-8000-000000008021', 1,
    'contact:fictive:delivery:b', 'sent', repeat('6', 64), repeat('b', 64),
    transaction_timestamp()
  );

insert into public.communication_events (
  institution_id, communication_id, resource_type, resource_id, event_type,
  actor_type, external_event_hash, summary
) values (
  '00000000-0000-4000-8000-000000008002',
  '00000000-0000-4000-8000-000000008010', 'delivery',
  '00000000-0000-4000-8000-000000008030', 'delivery.delivered',
  'provider', repeat('c', 64), '{"status":"delivered","fixture":true}'::jsonb
);

insert into public.communication_events (
  institution_id, communication_id, resource_type, resource_id, event_type,
  actor_type, external_event_hash, summary
) values (
  '00000000-0000-4000-8000-000000008002',
  '00000000-0000-4000-8000-000000008010', 'delivery',
  '00000000-0000-4000-8000-000000008030', 'delivery.delivered',
  'provider', repeat('c', 64), '{"status":"delivered","fixture":true}'::jsonb
) on conflict do nothing;

insert into public.communication_events (
  institution_id, communication_id, resource_type, resource_id, event_type,
  actor_type, external_event_hash, summary
) values (
  '00000000-0000-4000-8000-000000008003',
  '00000000-0000-4000-8000-000000008011', 'delivery',
  '00000000-0000-4000-8000-000000008031', 'delivery.delivered',
  'provider', repeat('c', 64), '{"status":"delivered","fixture":true}'::jsonb
);

do $$
declare
  invalid_hash_blocked boolean := false;
  invalid_status_blocked boolean := false;
begin
  begin
    insert into public.communication_events (
      institution_id, communication_id, resource_type, resource_id, event_type,
      actor_type, external_event_hash
    ) values (
      '00000000-0000-4000-8000-000000008002',
      '00000000-0000-4000-8000-000000008010', 'delivery',
      '00000000-0000-4000-8000-000000008030', 'delivery.rejected',
      'provider', 'not-a-hash'
    );
  exception when check_violation then
    invalid_hash_blocked := true;
  end;

  update public.communication_deliveries
  set status = 'spam'
  where id = '00000000-0000-4000-8000-000000008030';

  begin
    update public.communication_deliveries
    set status = 'opened'
    where id = '00000000-0000-4000-8000-000000008030';
  exception when check_violation then
    invalid_status_blocked := true;
  end;

  if not invalid_hash_blocked or not invalid_status_blocked then
    raise exception 'Communication delivery event security recipe failed';
  end if;

  if (select count(*) from public.communication_events
      where institution_id = '00000000-0000-4000-8000-000000008002'
        and external_event_hash = repeat('c', 64)) <> 1 then
    raise exception 'Provider event replay was not deduplicated';
  end if;

  if (select count(*) from public.communication_events
      where institution_id = '00000000-0000-4000-8000-000000008003'
        and external_event_hash = repeat('c', 64)) <> 1
    or (select count(*) from public.communication_events
        where external_event_hash = repeat('c', 64)) <> 2 then
    raise exception 'Provider event fingerprint was not isolated by institution';
  end if;

  if (select status from public.communication_deliveries
      where id = '00000000-0000-4000-8000-000000008030') <> 'spam' then
    raise exception 'Governed spam status was not accepted';
  end if;

  if exists (
    select 1
    from (values
      ('anon', 'public.communication_events'),
      ('anon', 'public.communication_deliveries'),
      ('authenticated', 'public.communication_events'),
      ('authenticated', 'public.communication_deliveries')
    ) as client_tables(role_name, table_name)
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as privileges(privilege_name)
    where has_table_privilege(role_name, table_name, privilege_name)
  ) then
    raise exception 'Client role unexpectedly has communication delivery privileges';
  end if;
end
$$;

rollback;

select
  (select count(*) from auth.users where id = '00000000-0000-4000-8000-000000008001') as auth_residue,
  (select count(*) from public.institutions where id in (
    '00000000-0000-4000-8000-000000008002',
    '00000000-0000-4000-8000-000000008003'
  )) as institution_residue,
  (select count(*) from public.communications where id in (
    '00000000-0000-4000-8000-000000008010',
    '00000000-0000-4000-8000-000000008011'
  )) as communication_residue,
  (select count(*) from public.communication_deliveries where id in (
    '00000000-0000-4000-8000-000000008030',
    '00000000-0000-4000-8000-000000008031'
  )) as delivery_residue,
  (select count(*) from public.communication_events where resource_id in (
    '00000000-0000-4000-8000-000000008030',
    '00000000-0000-4000-8000-000000008031'
  )) as event_residue;
