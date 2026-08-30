begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000005501',
  'authenticated', 'authenticated', 'communication-preview@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.institutions (id, slug, name, status) values
  ('00000000-0000-4000-8000-000000005502', 'communication-preview-a', 'Communication Preview A', 'draft'),
  ('00000000-0000-4000-8000-000000005503', 'communication-preview-b', 'Communication Preview B', 'draft');

insert into public.communication_settings (institution_id) values
  ('00000000-0000-4000-8000-000000005502');

insert into public.communications (
  id, institution_id, source_type, source_fingerprint, source_label, category, created_by
) values (
  '00000000-0000-4000-8000-000000005510',
  '00000000-0000-4000-8000-000000005502',
  'direct_text', repeat('a', 64), 'Source fictive', 'information',
  '00000000-0000-4000-8000-000000005501'
);

insert into public.communication_versions (
  id, institution_id, communication_id, version, title, body_markdown,
  content_hash, created_by
) values (
  '00000000-0000-4000-8000-000000005520',
  '00000000-0000-4000-8000-000000005502',
  '00000000-0000-4000-8000-000000005510',
  1, 'Information fictive', 'Contenu strictement fictif.', repeat('b', 64),
  '00000000-0000-4000-8000-000000005501'
);

insert into public.communication_audiences (
  id, institution_id, communication_id, group_ref, created_by
) values (
  '00000000-0000-4000-8000-000000005530',
  '00000000-0000-4000-8000-000000005502',
  '00000000-0000-4000-8000-000000005510',
  'staff:fictive', '00000000-0000-4000-8000-000000005501'
);

do $$
declare
  email_audience_blocked boolean := false;
  cross_scope_blocked boolean := false;
  duplicate_source_blocked boolean := false;
  disabled_delivery_blocked boolean := false;
  unapproved_delivery_blocked boolean := false;
  publication_job_blocked boolean := false;
  sending_job_blocked boolean := false;
  sending_transition_blocked boolean := false;
  approved_audience_blocked boolean := false;
  immutable_version_blocked boolean := false;
  append_only_event_blocked boolean := false;
  duplicate_job_blocked boolean := false;
begin
  begin
    insert into public.communication_audiences (
      institution_id, communication_id, group_ref, created_by
    ) values (
      '00000000-0000-4000-8000-000000005502',
      '00000000-0000-4000-8000-000000005510',
      'person@example.test', '00000000-0000-4000-8000-000000005501'
    );
  exception when check_violation then
    email_audience_blocked := true;
  end;

  begin
    insert into public.communication_audiences (
      institution_id, communication_id, group_ref, created_by
    ) values (
      '00000000-0000-4000-8000-000000005503',
      '00000000-0000-4000-8000-000000005510',
      'staff:cross-scope', '00000000-0000-4000-8000-000000005501'
    );
  exception when foreign_key_violation then
    cross_scope_blocked := true;
  end;

  begin
    insert into public.communications (
      institution_id, source_type, source_fingerprint, source_label, created_by
    ) values (
      '00000000-0000-4000-8000-000000005502',
      'direct_text', repeat('a', 64), 'Doublon fictif',
      '00000000-0000-4000-8000-000000005501'
    );
  exception when unique_violation then
    duplicate_source_blocked := true;
  end;

  begin
    insert into public.communication_deliveries (
      id, institution_id, communication_id, version_id, version, contact_ref,
      idempotency_key_hash
    ) values (
      '00000000-0000-4000-8000-000000005540',
      '00000000-0000-4000-8000-000000005502',
      '00000000-0000-4000-8000-000000005510',
      '00000000-0000-4000-8000-000000005520', 1,
      'contact:fictive:1', repeat('c', 64)
    );
  exception when raise_exception then
    disabled_delivery_blocked := sqlerrm = 'Communication module is disabled';
  end;

  update public.communication_settings
  set module_enabled = true,
      updated_by = '00000000-0000-4000-8000-000000005501'
  where institution_id = '00000000-0000-4000-8000-000000005502';

  begin
    insert into public.communication_deliveries (
      id, institution_id, communication_id, version_id, version, contact_ref,
      idempotency_key_hash
    ) values (
      '00000000-0000-4000-8000-000000005540',
      '00000000-0000-4000-8000-000000005502',
      '00000000-0000-4000-8000-000000005510',
      '00000000-0000-4000-8000-000000005520', 1,
      'contact:fictive:1', repeat('c', 64)
    );
  exception when raise_exception then
    unapproved_delivery_blocked := sqlerrm = 'Communication delivery requires an approved version';
  end;

  update public.communication_versions
  set status = 'approved',
      approved_by = '00000000-0000-4000-8000-000000005501',
      approved_at = transaction_timestamp()
  where id = '00000000-0000-4000-8000-000000005520';

  update public.communications
  set status = 'approved',
      visibility = 'public',
      public_slug = 'information-fictive',
      approved_by = '00000000-0000-4000-8000-000000005501',
      approved_at = transaction_timestamp()
  where id = '00000000-0000-4000-8000-000000005510';

  insert into public.communication_deliveries (
    id, institution_id, communication_id, version_id, version, contact_ref,
    idempotency_key_hash
  ) values (
    '00000000-0000-4000-8000-000000005540',
    '00000000-0000-4000-8000-000000005502',
    '00000000-0000-4000-8000-000000005510',
    '00000000-0000-4000-8000-000000005520', 1,
    'contact:fictive:1', repeat('c', 64)
  );

  begin
    insert into public.communication_jobs (
      institution_id, communication_id, version_id, version, job_type,
      idempotency_key_hash
    ) values (
      '00000000-0000-4000-8000-000000005502',
      '00000000-0000-4000-8000-000000005510',
      '00000000-0000-4000-8000-000000005520', 1,
      'publish', repeat('d', 64)
    );
  exception when raise_exception then
    publication_job_blocked := sqlerrm = 'Communication publication is disabled';
  end;

  insert into public.communication_jobs (
    id, institution_id, communication_id, version_id, version, job_type,
    idempotency_key_hash
  ) values (
    '00000000-0000-4000-8000-000000005550',
    '00000000-0000-4000-8000-000000005502',
    '00000000-0000-4000-8000-000000005510',
    '00000000-0000-4000-8000-000000005520', 1,
    'prepare_delivery', repeat('e', 64)
  );

  begin
    insert into public.communication_jobs (
      institution_id, communication_id, version_id, version, delivery_id,
      job_type, idempotency_key_hash
    ) values (
      '00000000-0000-4000-8000-000000005502',
      '00000000-0000-4000-8000-000000005510',
      '00000000-0000-4000-8000-000000005520', 1,
      '00000000-0000-4000-8000-000000005540',
      'send_delivery', repeat('f', 64)
    );
  exception when raise_exception then
    sending_job_blocked := sqlerrm = 'Communication sending is disabled';
  end;

  begin
    update public.communication_deliveries
    set status = 'queued', queued_at = transaction_timestamp()
    where id = '00000000-0000-4000-8000-000000005540';
  exception when raise_exception then
    sending_transition_blocked := sqlerrm = 'Communication sending is disabled';
  end;

  begin
    update public.communication_audiences
    set status = 'removed',
        removed_by = '00000000-0000-4000-8000-000000005501',
        removed_at = transaction_timestamp()
    where id = '00000000-0000-4000-8000-000000005530';
  exception when raise_exception then
    approved_audience_blocked := sqlerrm = 'Validated communication audiences are immutable';
  end;

  begin
    update public.communication_versions
    set title = 'Titre modifié après validation'
    where id = '00000000-0000-4000-8000-000000005520';
  exception when raise_exception then
    immutable_version_blocked := sqlerrm = 'Validated communication versions are immutable';
  end;

  insert into public.communication_events (
    institution_id, communication_id, resource_type, resource_id, event_type,
    actor_user_id, actor_type, summary
  ) values (
    '00000000-0000-4000-8000-000000005502',
    '00000000-0000-4000-8000-000000005510',
    'communication', '00000000-0000-4000-8000-000000005510',
    'communication.created', '00000000-0000-4000-8000-000000005501',
    'user', '{"fictive":true}'::jsonb
  );

  begin
    update public.communication_events
    set summary = '{"changed":true}'::jsonb
    where communication_id = '00000000-0000-4000-8000-000000005510';
  exception when raise_exception then
    append_only_event_blocked := sqlerrm = 'Communication events are append-only';
  end;

  update public.communication_settings
  set publication_enabled = true,
      sending_enabled = true
  where institution_id = '00000000-0000-4000-8000-000000005502';

  insert into public.site_content_items (
    id, content_type, slug, title, body_markdown, status, created_by
  ) values (
    '00000000-0000-4000-8000-000000005560',
    'article', 'communication-preview-fictive', 'Information fictive',
    'Contenu fictif.', 'brouillon', '00000000-0000-4000-8000-000000005501'
  );

  update public.communications
  set status = 'published',
      site_content_id = '00000000-0000-4000-8000-000000005560',
      published_at = transaction_timestamp()
  where id = '00000000-0000-4000-8000-000000005510';

  insert into public.communication_jobs (
    id, institution_id, communication_id, version_id, version, delivery_id,
    job_type, idempotency_key_hash
  ) values (
    '00000000-0000-4000-8000-000000005551',
    '00000000-0000-4000-8000-000000005502',
    '00000000-0000-4000-8000-000000005510',
    '00000000-0000-4000-8000-000000005520', 1,
    '00000000-0000-4000-8000-000000005540',
    'send_delivery', repeat('f', 64)
  );

  begin
    insert into public.communication_jobs (
      institution_id, communication_id, version_id, version, delivery_id,
      job_type, idempotency_key_hash
    ) values (
      '00000000-0000-4000-8000-000000005502',
      '00000000-0000-4000-8000-000000005510',
      '00000000-0000-4000-8000-000000005520', 1,
      '00000000-0000-4000-8000-000000005540',
      'send_delivery', repeat('f', 64)
    );
  exception when unique_violation then
    duplicate_job_blocked := true;
  end;

  if not (
    email_audience_blocked and cross_scope_blocked and duplicate_source_blocked
    and disabled_delivery_blocked and unapproved_delivery_blocked
    and publication_job_blocked and sending_job_blocked
    and sending_transition_blocked and approved_audience_blocked
    and immutable_version_blocked and append_only_event_blocked
    and duplicate_job_blocked
  ) then
    raise exception 'Communication security recipe failed';
  end if;
end;
$$;

rollback;

select
  (select count(*) from auth.users where id = '00000000-0000-4000-8000-000000005501') as auth_residue,
  (select count(*) from public.institutions where id in (
    '00000000-0000-4000-8000-000000005502',
    '00000000-0000-4000-8000-000000005503'
  )) as institution_residue,
  (select count(*) from public.communications where id = '00000000-0000-4000-8000-000000005510') as communication_residue,
  (select count(*) from public.communication_jobs where institution_id = '00000000-0000-4000-8000-000000005502') as job_residue;
