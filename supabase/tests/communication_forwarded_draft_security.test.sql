begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000008001',
  'authenticated', 'authenticated', 'communication-forwarded@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"fixture":true}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.institutions (id, slug, name, status) values (
  '00000000-0000-4000-8000-000000008002',
  'forwarded-draft-preview',
  'Forwarded Draft Preview',
  'pilot'
);

insert into public.institution_memberships (
  institution_id, user_id, role, service_codes, status, granted_by
) values (
  '00000000-0000-4000-8000-000000008002',
  '00000000-0000-4000-8000-000000008001',
  'admin', array[]::text[], 'active',
  '00000000-0000-4000-8000-000000008001'
);

insert into public.communication_inbound (
  id, institution_id, provider, external_message_hash, status, classification
) values (
  '00000000-0000-4000-8000-000000008010',
  '00000000-0000-4000-8000-000000008002',
  'brevo_forward', repeat('1', 64), 'received', 'forwarded_source'
);

insert into public.communications (
  id, institution_id, source_type, source_fingerprint, source_label, status,
  visibility, category, current_version, created_by
) values (
  '00000000-0000-4000-8000-000000008020',
  '00000000-0000-4000-8000-000000008002',
  'forwarded_email', repeat('2', 64), 'Email transféré fictif', 'draft',
  'internal', 'information', 1,
  '00000000-0000-4000-8000-000000008001'
);

insert into public.communication_versions (
  id, institution_id, communication_id, version, status, title, summary,
  body_markdown, structured_facts, open_questions, content_hash, created_by
) values (
  '00000000-0000-4000-8000-000000008021',
  '00000000-0000-4000-8000-000000008002',
  '00000000-0000-4000-8000-000000008020', 1, 'draft',
  'Information transférée fictive', 'Résumé fictif.', 'Contenu fictif à relire.',
  '{"dates":[],"times":[],"places":[],"documents":[],"actions":[]}'::jsonb,
  '["Confirmer le titre et le public avant toute publication."]'::jsonb,
  repeat('3', 64), '00000000-0000-4000-8000-000000008001'
);

update public.communication_inbound
set communication_id = '00000000-0000-4000-8000-000000008020',
    created_draft_id = '00000000-0000-4000-8000-000000008020',
    status = 'processed',
    processed_at = transaction_timestamp()
where id = '00000000-0000-4000-8000-000000008010'
  and institution_id = '00000000-0000-4000-8000-000000008002'
  and status = 'received';

insert into public.communication_events (
  institution_id, communication_id, resource_type, resource_id, event_type,
  actor_user_id, actor_type, external_event_hash, summary
) values (
  '00000000-0000-4000-8000-000000008002',
  '00000000-0000-4000-8000-000000008020',
  'inbound', '00000000-0000-4000-8000-000000008010',
  'inbound.draft_created', '00000000-0000-4000-8000-000000008001',
  'system', repeat('1', 64),
  '{"sourceType":"forwarded_email","attachmentCount":0,"privacySignals":[],"redactionRequiredBeforeAi":false,"requiresHumanReview":true,"visibility":"internal"}'::jsonb
);

insert into public.communication_inbound (
  institution_id, provider, external_message_hash, status, classification
) values (
  '00000000-0000-4000-8000-000000008002',
  'brevo_forward', repeat('1', 64), 'received', 'forwarded_source'
) on conflict do nothing;

insert into public.communications (
  institution_id, source_type, source_fingerprint, source_label, created_by
) values (
  '00000000-0000-4000-8000-000000008002',
  'forwarded_email', repeat('2', 64), 'Rejeu fictif',
  '00000000-0000-4000-8000-000000008001'
) on conflict (institution_id, source_fingerprint) do nothing;

do $$
begin
  if (select count(*) from public.communication_inbound
      where institution_id = '00000000-0000-4000-8000-000000008002'
        and provider = 'brevo_forward' and external_message_hash = repeat('1', 64)) <> 1
    or (select count(*) from public.communications
        where institution_id = '00000000-0000-4000-8000-000000008002'
          and source_fingerprint = repeat('2', 64)) <> 1
    or (select count(*) from public.communication_versions
        where communication_id = '00000000-0000-4000-8000-000000008020') <> 1
    or (select count(*) from public.communication_events
        where communication_id = '00000000-0000-4000-8000-000000008020') <> 1 then
    raise exception 'Forwarded draft idempotence failed';
  end if;

  if not exists (
    select 1
    from public.communication_inbound inbound
    join public.communications draft
      on draft.id = inbound.created_draft_id
     and draft.institution_id = inbound.institution_id
    where inbound.id = '00000000-0000-4000-8000-000000008010'
      and inbound.communication_id = draft.id
      and inbound.status = 'processed'
      and inbound.classification = 'forwarded_source'
      and inbound.processed_at is not null
      and draft.source_type = 'forwarded_email'
      and draft.status = 'draft'
      and draft.visibility = 'internal'
  ) then
    raise exception 'Forwarded draft linkage failed';
  end if;

  if exists (
    select 1 from public.communication_audiences
    where communication_id = '00000000-0000-4000-8000-000000008020'
    union all
    select 1 from public.communication_deliveries
    where communication_id = '00000000-0000-4000-8000-000000008020'
    union all
    select 1 from public.communication_jobs
    where communication_id = '00000000-0000-4000-8000-000000008020'
  ) then
    raise exception 'Forwarded draft unexpectedly opened an audience or delivery';
  end if;

  if not exists (
    select 1 from public.institution_memberships
    where institution_id = '00000000-0000-4000-8000-000000008002'
      and user_id = '00000000-0000-4000-8000-000000008001'
      and role = 'admin' and status = 'active'
  ) then
    raise exception 'Forwarded draft actor is not an active institution admin';
  end if;

  if exists (
    select 1
    from (values
      ('anon', 'public.communication_inbound'),
      ('anon', 'public.communications'),
      ('authenticated', 'public.communication_inbound'),
      ('authenticated', 'public.communications')
    ) as client_tables(role_name, table_name)
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as privileges(privilege_name)
    where has_table_privilege(role_name, table_name, privilege_name)
  ) then
    raise exception 'Client role unexpectedly has forwarded draft privileges';
  end if;
end
$$;

rollback;

select
  (select count(*) from auth.users
   where id = '00000000-0000-4000-8000-000000008001') as auth_residue,
  (select count(*) from public.institutions
   where id = '00000000-0000-4000-8000-000000008002') as institution_residue,
  (select count(*) from public.institution_memberships
   where institution_id = '00000000-0000-4000-8000-000000008002') as membership_residue,
  (select count(*) from public.communications
   where id = '00000000-0000-4000-8000-000000008020') as communication_residue,
  (select count(*) from public.communication_versions
   where id = '00000000-0000-4000-8000-000000008021') as version_residue,
  (select count(*) from public.communication_inbound
   where id = '00000000-0000-4000-8000-000000008010') as inbound_residue,
  (select count(*) from public.communication_events
   where communication_id = '00000000-0000-4000-8000-000000008020') as event_residue;
