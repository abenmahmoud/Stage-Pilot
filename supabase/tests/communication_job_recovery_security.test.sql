begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000009001',
  'authenticated', 'authenticated', 'communication-job-recovery@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"fixture":true}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.institutions (id, slug, name, status) values (
  '00000000-0000-4000-8000-000000009002',
  'communication-job-recovery',
  'Communication Job Recovery',
  'draft'
);

insert into public.communication_settings (
  institution_id, module_enabled, publication_enabled, sending_enabled, updated_by
) values (
  '00000000-0000-4000-8000-000000009002',
  true, false, true,
  '00000000-0000-4000-8000-000000009001'
);

insert into public.communications (
  id, institution_id, source_type, source_fingerprint, source_label, created_by
) values (
  '00000000-0000-4000-8000-000000009010',
  '00000000-0000-4000-8000-000000009002',
  'direct_text', repeat('1', 64), 'Communication fictive',
  '00000000-0000-4000-8000-000000009001'
);

insert into public.communication_versions (
  id, institution_id, communication_id, version, title, body_markdown,
  content_hash, created_by
) values (
  '00000000-0000-4000-8000-000000009020',
  '00000000-0000-4000-8000-000000009002',
  '00000000-0000-4000-8000-000000009010',
  1, 'Message fictif', 'Contenu fictif.', repeat('2', 64),
  '00000000-0000-4000-8000-000000009001'
);

do $$
declare
  draft_delivery_blocked boolean := false;
begin
  begin
    insert into public.communication_deliveries (
      id, institution_id, communication_id, version_id, version, contact_ref,
      status, idempotency_key_hash
    ) values (
      '00000000-0000-4000-8000-000000009029',
      '00000000-0000-4000-8000-000000009002',
      '00000000-0000-4000-8000-000000009010',
      '00000000-0000-4000-8000-000000009020',
      1, 'contact:fictive:draft', 'prepared', repeat('3', 64)
    );
  exception when raise_exception then
    draft_delivery_blocked := true;
  end;

  if not draft_delivery_blocked then
    raise exception 'Draft communication delivery bypassed approval guards';
  end if;
end
$$;

update public.communication_versions
set status = 'review'
where id = '00000000-0000-4000-8000-000000009020';

update public.communications
set status = 'review'
where id = '00000000-0000-4000-8000-000000009010';

update public.communication_versions
set status = 'approved',
    approved_by = '00000000-0000-4000-8000-000000009001',
    approved_at = transaction_timestamp()
where id = '00000000-0000-4000-8000-000000009020';

update public.communications
set status = 'approved',
    approved_by = '00000000-0000-4000-8000-000000009001',
    approved_at = transaction_timestamp()
where id = '00000000-0000-4000-8000-000000009010';

insert into public.communication_deliveries (
  id, institution_id, communication_id, version_id, version, contact_ref,
  status, idempotency_key_hash, provider_message_ref
) values
  (
    '00000000-0000-4000-8000-000000009030',
    '00000000-0000-4000-8000-000000009002',
    '00000000-0000-4000-8000-000000009010',
    '00000000-0000-4000-8000-000000009020',
    1, 'contact:fictive:cancel', 'prepared', repeat('4', 64), null
  ),
  (
    '00000000-0000-4000-8000-000000009031',
    '00000000-0000-4000-8000-000000009002',
    '00000000-0000-4000-8000-000000009010',
    '00000000-0000-4000-8000-000000009020',
    1, 'contact:fictive:running', 'sent', repeat('5', 64), repeat('a', 64)
  ),
  (
    '00000000-0000-4000-8000-000000009032',
    '00000000-0000-4000-8000-000000009002',
    '00000000-0000-4000-8000-000000009010',
    '00000000-0000-4000-8000-000000009020',
    1, 'contact:fictive:failure', 'queued', repeat('6', 64), null
  );

insert into public.communication_jobs (
  id, institution_id, communication_id, version_id, version, delivery_id,
  job_type, status, idempotency_key_hash, attempt_count, locked_at
) values
  (
    '00000000-0000-4000-8000-000000009040',
    '00000000-0000-4000-8000-000000009002',
    '00000000-0000-4000-8000-000000009010',
    '00000000-0000-4000-8000-000000009020',
    1, '00000000-0000-4000-8000-000000009030',
    'send_delivery', 'pending', repeat('7', 64), 0, null
  ),
  (
    '00000000-0000-4000-8000-000000009041',
    '00000000-0000-4000-8000-000000009002',
    '00000000-0000-4000-8000-000000009010',
    '00000000-0000-4000-8000-000000009020',
    1, '00000000-0000-4000-8000-000000009031',
    'send_delivery', 'running', repeat('8', 64), 1, transaction_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000009042',
    '00000000-0000-4000-8000-000000009002',
    '00000000-0000-4000-8000-000000009010',
    '00000000-0000-4000-8000-000000009020',
    1, '00000000-0000-4000-8000-000000009032',
    'send_delivery', 'running', repeat('9', 64), 4, transaction_timestamp()
  );

update public.communication_jobs
set status = 'dead',
    attempt_count = 5,
    last_error_code = 'provider_unavailable'
where id = '00000000-0000-4000-8000-000000009042';

update public.communication_deliveries
set status = 'error',
    attempt_count = 5,
    last_error_code = 'provider_unavailable'
where id = '00000000-0000-4000-8000-000000009032';

insert into public.communication_jobs (
  institution_id, communication_id, version_id, version, delivery_id,
  job_type, status, idempotency_key_hash, attempt_count
) values (
  '00000000-0000-4000-8000-000000009002',
  '00000000-0000-4000-8000-000000009010',
  '00000000-0000-4000-8000-000000009020',
  1, '00000000-0000-4000-8000-000000009032',
  'retry_delivery', 'pending', repeat('d', 64), 0
) on conflict do nothing;

insert into public.communication_jobs (
  institution_id, communication_id, version_id, version, delivery_id,
  job_type, status, idempotency_key_hash, attempt_count
) values (
  '00000000-0000-4000-8000-000000009002',
  '00000000-0000-4000-8000-000000009010',
  '00000000-0000-4000-8000-000000009020',
  1, '00000000-0000-4000-8000-000000009032',
  'retry_delivery', 'pending', repeat('d', 64), 0
) on conflict do nothing;

update public.communication_settings
set module_enabled = false,
    publication_enabled = false,
    sending_enabled = false
where institution_id = '00000000-0000-4000-8000-000000009002';

update public.communication_jobs
set status = 'cancelled'
where id = '00000000-0000-4000-8000-000000009040';

update public.communication_deliveries
set status = 'cancelled'
where id = '00000000-0000-4000-8000-000000009030';

do $$
declare
  running_job_cancel_blocked boolean := false;
  sent_delivery_cancel_blocked boolean := false;
begin
  begin
    update public.communication_jobs
    set status = 'cancelled'
    where id = '00000000-0000-4000-8000-000000009041';
  exception when raise_exception then
    running_job_cancel_blocked := true;
  end;

  begin
    update public.communication_deliveries
    set status = 'cancelled'
    where id = '00000000-0000-4000-8000-000000009031';
  exception when raise_exception then
    sent_delivery_cancel_blocked := true;
  end;

  if not running_job_cancel_blocked or not sent_delivery_cancel_blocked then
    raise exception 'Emergency cancellation exceeded the pre-send boundary';
  end if;

  if (select status from public.communication_jobs
      where id = '00000000-0000-4000-8000-000000009040') <> 'cancelled'
    or (select status from public.communication_deliveries
        where id = '00000000-0000-4000-8000-000000009030') <> 'cancelled'
    or (select status from public.communication_jobs
        where id = '00000000-0000-4000-8000-000000009041') <> 'running'
    or (select status from public.communication_deliveries
        where id = '00000000-0000-4000-8000-000000009031') <> 'sent' then
    raise exception 'Emergency cancellation state invariant failed';
  end if;

  if (select count(*) from public.communication_jobs
      where institution_id = '00000000-0000-4000-8000-000000009002'
        and idempotency_key_hash = repeat('d', 64)) <> 1 then
    raise exception 'Manual retry successor was not idempotent';
  end if;

  if exists (
    select 1
    from (values
      ('anon', 'public.communication_jobs'),
      ('anon', 'public.communication_deliveries'),
      ('authenticated', 'public.communication_jobs'),
      ('authenticated', 'public.communication_deliveries')
    ) as client_tables(role_name, table_name)
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as privileges(privilege_name)
    where has_table_privilege(role_name, table_name, privilege_name)
  ) then
    raise exception 'Client role unexpectedly has communication recovery privileges';
  end if;
end
$$;

rollback;

select
  (select count(*) from auth.users where id = '00000000-0000-4000-8000-000000009001') as auth_residue,
  (select count(*) from public.institutions
   where id = '00000000-0000-4000-8000-000000009002') as institution_residue,
  (select count(*) from public.communications
   where id = '00000000-0000-4000-8000-000000009010') as communication_residue,
  (select count(*) from public.communication_deliveries
   where institution_id = '00000000-0000-4000-8000-000000009002') as delivery_residue,
  (select count(*) from public.communication_jobs
   where institution_id = '00000000-0000-4000-8000-000000009002') as job_residue,
  (select count(*) from public.communication_events
   where institution_id = '00000000-0000-4000-8000-000000009002') as event_residue;
