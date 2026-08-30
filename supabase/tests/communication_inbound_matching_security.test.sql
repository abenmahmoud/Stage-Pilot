begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000006001',
  'authenticated', 'authenticated', 'communication-inbound-matching@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"fixture":true}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.institutions (id, slug, name, status) values
  ('00000000-0000-4000-8000-000000006002', 'inbound-matching-a', 'Inbound Matching A', 'draft'),
  ('00000000-0000-4000-8000-000000006003', 'inbound-matching-b', 'Inbound Matching B', 'draft');

insert into public.communication_settings (
  institution_id, module_enabled, sending_enabled, updated_by
) values
  ('00000000-0000-4000-8000-000000006002', true, true, '00000000-0000-4000-8000-000000006001'),
  ('00000000-0000-4000-8000-000000006003', true, true, '00000000-0000-4000-8000-000000006001');

insert into public.communications (
  id, institution_id, source_type, source_fingerprint, source_label, created_by
) values
  (
    '00000000-0000-4000-8000-000000006010',
    '00000000-0000-4000-8000-000000006002',
    'direct_text', repeat('1', 64), 'Réponse fictive A',
    '00000000-0000-4000-8000-000000006001'
  ),
  (
    '00000000-0000-4000-8000-000000006011',
    '00000000-0000-4000-8000-000000006003',
    'direct_text', repeat('2', 64), 'Réponse fictive B',
    '00000000-0000-4000-8000-000000006001'
  );

insert into public.communication_versions (
  id, institution_id, communication_id, version, title, body_markdown,
  content_hash, created_by
) values
  (
    '00000000-0000-4000-8000-000000006020',
    '00000000-0000-4000-8000-000000006002',
    '00000000-0000-4000-8000-000000006010', 1,
    'Message fictif A', 'Contenu fictif A.', repeat('3', 64),
    '00000000-0000-4000-8000-000000006001'
  ),
  (
    '00000000-0000-4000-8000-000000006021',
    '00000000-0000-4000-8000-000000006003',
    '00000000-0000-4000-8000-000000006011', 1,
    'Message fictif B', 'Contenu fictif B.', repeat('4', 64),
    '00000000-0000-4000-8000-000000006001'
  );

update public.communication_versions
set status = 'review'
where id in (
  '00000000-0000-4000-8000-000000006020',
  '00000000-0000-4000-8000-000000006021'
);

update public.communications
set status = 'review'
where id in (
  '00000000-0000-4000-8000-000000006010',
  '00000000-0000-4000-8000-000000006011'
);

update public.communication_versions
set status = 'approved',
    approved_by = '00000000-0000-4000-8000-000000006001',
    approved_at = transaction_timestamp()
where id in (
  '00000000-0000-4000-8000-000000006020',
  '00000000-0000-4000-8000-000000006021'
);

update public.communications
set status = 'approved',
    approved_by = '00000000-0000-4000-8000-000000006001',
    approved_at = transaction_timestamp()
where id in (
  '00000000-0000-4000-8000-000000006010',
  '00000000-0000-4000-8000-000000006011'
);

insert into public.communication_deliveries (
  id, institution_id, communication_id, version_id, version, contact_ref,
  status, idempotency_key_hash, resolution_hash, command_hash,
  provider_message_ref, webmail_receipt_hash, sent_at
) values
  (
    '00000000-0000-4000-8000-000000006030',
    '00000000-0000-4000-8000-000000006002',
    '00000000-0000-4000-8000-000000006010',
    '00000000-0000-4000-8000-000000006020', 1,
    'contact:fictive:inbound:a', 'sent', repeat('5', 64), repeat('6', 64),
    repeat('7', 64), repeat('a', 64), repeat('8', 64), transaction_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000006031',
    '00000000-0000-4000-8000-000000006003',
    '00000000-0000-4000-8000-000000006011',
    '00000000-0000-4000-8000-000000006021', 1,
    'contact:fictive:inbound:b', 'sent', repeat('9', 64), repeat('b', 64),
    repeat('c', 64), repeat('a', 64), repeat('d', 64), transaction_timestamp()
  );

insert into public.communication_inbound (
  id, institution_id, communication_id, provider, external_message_hash, status
) values (
  '00000000-0000-4000-8000-000000006040',
  '00000000-0000-4000-8000-000000006002',
  '00000000-0000-4000-8000-000000006010',
  'brevo_inbound', repeat('e', 64), 'received'
);

insert into public.communication_inbound (
  institution_id, communication_id, provider, external_message_hash, status
) values (
  '00000000-0000-4000-8000-000000006002',
  '00000000-0000-4000-8000-000000006010',
  'brevo_inbound', repeat('e', 64), 'received'
) on conflict do nothing;

insert into public.communication_inbound (
  id, institution_id, communication_id, provider, external_message_hash, status
) values (
  '00000000-0000-4000-8000-000000006041',
  '00000000-0000-4000-8000-000000006003',
  '00000000-0000-4000-8000-000000006011',
  'brevo_inbound', repeat('e', 64), 'received'
);

insert into public.communication_inbound (
  id, institution_id, communication_id, provider, external_message_hash, status
) values (
  '00000000-0000-4000-8000-000000006042',
  '00000000-0000-4000-8000-000000006002',
  null, 'brevo_inbound', repeat('f', 64), 'review'
);

insert into public.communication_events (
  institution_id, communication_id, resource_type, resource_id, event_type,
  actor_type, external_event_hash, summary
) values
  (
    '00000000-0000-4000-8000-000000006002',
    '00000000-0000-4000-8000-000000006010', 'inbound',
    '00000000-0000-4000-8000-000000006040', 'inbound.received',
    'provider', repeat('e', 64), '{"matchReason":"in_reply_to_exact"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000006003',
    '00000000-0000-4000-8000-000000006011', 'inbound',
    '00000000-0000-4000-8000-000000006041', 'inbound.received',
    'provider', repeat('e', 64), '{"matchReason":"in_reply_to_exact"}'::jsonb
  );

do $$
declare
  same_scope_provider_duplicate_blocked boolean := false;
  cross_scope_inbound_blocked boolean := false;
begin
  begin
    insert into public.communication_deliveries (
      institution_id, communication_id, version_id, version, contact_ref,
      status, idempotency_key_hash, resolution_hash, command_hash,
      provider_message_ref, webmail_receipt_hash, sent_at
    ) values (
      '00000000-0000-4000-8000-000000006002',
      '00000000-0000-4000-8000-000000006010',
      '00000000-0000-4000-8000-000000006020', 1,
      'contact:fictive:inbound:duplicate', 'sent', repeat('0', 64),
      repeat('1', 64), repeat('2', 64), repeat('a', 64), repeat('3', 64),
      transaction_timestamp()
    );
  exception when unique_violation then
    same_scope_provider_duplicate_blocked := true;
  end;

  begin
    insert into public.communication_inbound (
      institution_id, communication_id, provider, external_message_hash, status
    ) values (
      '00000000-0000-4000-8000-000000006002',
      '00000000-0000-4000-8000-000000006011',
      'brevo_inbound', repeat('0', 64), 'received'
    );
  exception when foreign_key_violation then
    cross_scope_inbound_blocked := true;
  end;

  if not same_scope_provider_duplicate_blocked or not cross_scope_inbound_blocked then
    raise exception 'Inbound matching scope or uniqueness guard failed';
  end if;

  if (select count(*) from public.communication_deliveries
      where provider_message_ref = repeat('a', 64)) <> 2
    or (select count(*) from public.communication_deliveries
        where institution_id = '00000000-0000-4000-8000-000000006002'
          and provider_message_ref = repeat('a', 64)) <> 1
    or (select count(*) from public.communication_inbound
        where institution_id = '00000000-0000-4000-8000-000000006002') <> 2
    or (select count(*) from public.communication_inbound
        where institution_id = '00000000-0000-4000-8000-000000006003') <> 1
    or (select communication_id from public.communication_inbound
        where id = '00000000-0000-4000-8000-000000006042') is not null then
    raise exception 'Inbound matching persistence invariant failed';
  end if;

  if exists (
    select 1
    from (values
      ('anon', 'public.communication_inbound'),
      ('anon', 'public.communication_deliveries'),
      ('authenticated', 'public.communication_inbound'),
      ('authenticated', 'public.communication_deliveries')
    ) as client_tables(role_name, table_name)
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as privileges(privilege_name)
    where has_table_privilege(role_name, table_name, privilege_name)
  ) then
    raise exception 'Client role unexpectedly has inbound matching privileges';
  end if;
end
$$;

rollback;

select
  (select count(*) from auth.users
   where id = '00000000-0000-4000-8000-000000006001') as auth_residue,
  (select count(*) from public.institutions
   where id in (
     '00000000-0000-4000-8000-000000006002',
     '00000000-0000-4000-8000-000000006003'
   )) as institution_residue,
  (select count(*) from public.communications
   where id in (
     '00000000-0000-4000-8000-000000006010',
     '00000000-0000-4000-8000-000000006011'
   )) as communication_residue,
  (select count(*) from public.communication_deliveries
   where institution_id in (
     '00000000-0000-4000-8000-000000006002',
     '00000000-0000-4000-8000-000000006003'
   )) as delivery_residue,
  (select count(*) from public.communication_inbound
   where institution_id in (
     '00000000-0000-4000-8000-000000006002',
     '00000000-0000-4000-8000-000000006003'
   )) as inbound_residue,
  (select count(*) from public.communication_events
   where institution_id in (
     '00000000-0000-4000-8000-000000006002',
     '00000000-0000-4000-8000-000000006003'
   )) as event_residue;
