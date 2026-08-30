begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000007001',
  'authenticated', 'authenticated', 'communication-inbound-classification@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"fixture":true}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.institutions (id, slug, name, status) values (
  '00000000-0000-4000-8000-000000007002',
  'inbound-classification-preview',
  'Inbound Classification Preview',
  'draft'
);

insert into public.communications (
  id, institution_id, source_type, source_fingerprint, source_label, created_by
) values (
  '00000000-0000-4000-8000-000000007010',
  '00000000-0000-4000-8000-000000007002',
  'direct_text', repeat('7', 64), 'Classement entrant fictif',
  '00000000-0000-4000-8000-000000007001'
);

insert into public.communication_versions (
  id, institution_id, communication_id, version, title, body_markdown,
  content_hash, created_by
) values (
  '00000000-0000-4000-8000-000000007020',
  '00000000-0000-4000-8000-000000007002',
  '00000000-0000-4000-8000-000000007010', 1,
  'Communication fictive pour classement', 'Contenu fictif.', repeat('8', 64),
  '00000000-0000-4000-8000-000000007001'
);

insert into public.communication_inbound (
  id, institution_id, communication_id, provider, external_message_hash,
  status, classification
) values
  (
    '00000000-0000-4000-8000-000000007030',
    '00000000-0000-4000-8000-000000007002',
    '00000000-0000-4000-8000-000000007010',
    'brevo_inbound', repeat('1', 64), 'review', 'withdrawal'
  ),
  (
    '00000000-0000-4000-8000-000000007031',
    '00000000-0000-4000-8000-000000007002',
    '00000000-0000-4000-8000-000000007010',
    'brevo_inbound', repeat('2', 64), 'review', 'contact_correction'
  ),
  (
    '00000000-0000-4000-8000-000000007032',
    '00000000-0000-4000-8000-000000007002',
    '00000000-0000-4000-8000-000000007010',
    'brevo_inbound', repeat('3', 64), 'review', 'question'
  ),
  (
    '00000000-0000-4000-8000-000000007033',
    '00000000-0000-4000-8000-000000007002',
    '00000000-0000-4000-8000-000000007010',
    'brevo_inbound', repeat('4', 64), 'review', 'free_reply'
  ),
  (
    '00000000-0000-4000-8000-000000007034',
    '00000000-0000-4000-8000-000000007002',
    null, 'brevo_inbound', repeat('5', 64), 'received', null
  );

do $$
declare
  invalid_classification_blocked boolean := false;
begin
  begin
    insert into public.communication_inbound (
      institution_id, communication_id, provider, external_message_hash,
      status, classification
    ) values (
      '00000000-0000-4000-8000-000000007002',
      '00000000-0000-4000-8000-000000007010',
      'brevo_inbound', repeat('6', 64), 'review', 'automatic_action'
    );
  exception when check_violation then
    invalid_classification_blocked := true;
  end;

  if not invalid_classification_blocked then
    raise exception 'Invalid inbound classification was accepted';
  end if;

  if (select count(*) from public.communication_inbound
      where institution_id = '00000000-0000-4000-8000-000000007002'
        and status = 'review'
        and classification in ('withdrawal', 'contact_correction', 'question', 'free_reply')) <> 4
    or (select count(*) from public.communication_inbound
        where institution_id = '00000000-0000-4000-8000-000000007002'
          and status = 'received' and classification is null) <> 1
    or (select title from public.communication_versions
        where communication_id = '00000000-0000-4000-8000-000000007010'
          and version = 1) <> 'Communication fictive pour classement' then
    raise exception 'Inbound classification persistence invariant failed';
  end if;

  if exists (
    select 1
    from (values
      ('anon', 'public.communication_inbound'),
      ('authenticated', 'public.communication_inbound')
    ) as client_tables(role_name, table_name)
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as privileges(privilege_name)
    where has_table_privilege(role_name, table_name, privilege_name)
  ) then
    raise exception 'Client role unexpectedly has inbound classification privileges';
  end if;
end
$$;

rollback;

select
  (select count(*) from auth.users
   where id = '00000000-0000-4000-8000-000000007001') as auth_residue,
  (select count(*) from public.institutions
   where id = '00000000-0000-4000-8000-000000007002') as institution_residue,
  (select count(*) from public.communications
   where id = '00000000-0000-4000-8000-000000007010') as communication_residue,
  (select count(*) from public.communication_inbound
   where institution_id = '00000000-0000-4000-8000-000000007002') as inbound_residue;
