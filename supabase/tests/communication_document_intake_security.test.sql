begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000005701',
  'authenticated', 'authenticated', 'communication-source@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.institutions (id, slug, name, status) values
  ('00000000-0000-4000-8000-000000005702', 'communication-source-a', 'Source Preview A', 'draft'),
  ('00000000-0000-4000-8000-000000005703', 'communication-source-b', 'Source Preview B', 'draft');

insert into public.communication_source_documents (
  id, institution_id, original_name, mime_type, size_bytes,
  storage_path, uploaded_by
) values (
  '00000000-0000-4000-8000-000000005710',
  '00000000-0000-4000-8000-000000005702',
  'information-fictive.pdf', 'application/pdf', 100,
  '00000000-0000-4000-8000-000000005702/00000000-0000-4000-8000-000000005701/2026/08/00000000-0000-4000-8000-000000005710.pdf',
  '00000000-0000-4000-8000-000000005701'
);

insert into public.communication_source_events (
  institution_id, source_document_id, event_type, actor_user_id, actor_type, summary
) values (
  '00000000-0000-4000-8000-000000005702',
  '00000000-0000-4000-8000-000000005710',
  'source.reserved', '00000000-0000-4000-8000-000000005701', 'user',
  '{"fixture":true}'::jsonb
);

update public.communication_source_documents
set status = 'quarantined', uploaded_at = transaction_timestamp()
where id = '00000000-0000-4000-8000-000000005710';
update public.communication_source_documents
set status = 'processing'
where id = '00000000-0000-4000-8000-000000005710';
update public.communication_source_documents
set status = 'review', checksum = repeat('a', 64), extracted_text = 'Texte fictif sûr',
    extraction_summary = '{"state":"extracted"}'::jsonb, analyzed_at = transaction_timestamp()
where id = '00000000-0000-4000-8000-000000005710';

insert into public.communication_source_documents (
  id, institution_id, original_name, mime_type, size_bytes,
  storage_path, uploaded_by
) values (
  '00000000-0000-4000-8000-000000005711',
  '00000000-0000-4000-8000-000000005702',
  'autre-information-fictive.pdf', 'application/pdf', 110,
  '00000000-0000-4000-8000-000000005702/00000000-0000-4000-8000-000000005701/2026/08/00000000-0000-4000-8000-000000005711.pdf',
  '00000000-0000-4000-8000-000000005701'
);

do $$
declare
  forged_initial_state_blocked boolean := false;
  forged_actor_blocked boolean := false;
  cross_scope_blocked boolean := false;
  duplicate_blocked boolean := false;
  identity_change_blocked boolean := false;
  invalid_transition_blocked boolean := false;
  used_without_communication_blocked boolean := false;
  text_outside_review_blocked boolean := false;
  append_only_blocked boolean := false;
  final_mutation_blocked boolean := false;
begin
  begin
    insert into public.communication_source_documents (
      institution_id, original_name, mime_type, size_bytes, storage_path,
      status, checksum, uploaded_by
    ) values (
      '00000000-0000-4000-8000-000000005702', 'forged.pdf', 'application/pdf', 10,
      '00000000-0000-4000-8000-000000005702/00000000-0000-4000-8000-000000005701/2026/08/00000000-0000-4000-8000-000000005712.pdf',
      'review', repeat('f', 64), '00000000-0000-4000-8000-000000005701'
    );
  exception when others then
    forged_initial_state_blocked := true;
  end;

  begin
    insert into public.communication_source_events (
      institution_id, source_document_id, event_type, actor_user_id, actor_type
    ) values (
      '00000000-0000-4000-8000-000000005702',
      '00000000-0000-4000-8000-000000005710',
      'source.scanned', '00000000-0000-4000-8000-000000005701', 'system'
    );
  exception when check_violation then
    forged_actor_blocked := true;
  end;

  begin
    insert into public.communication_source_events (
      institution_id, source_document_id, event_type, actor_user_id, actor_type
    ) values (
      '00000000-0000-4000-8000-000000005703',
      '00000000-0000-4000-8000-000000005710',
      'source.scanned', null, 'system'
    );
  exception when foreign_key_violation then
    cross_scope_blocked := true;
  end;

  update public.communication_source_documents
  set status = 'quarantined', uploaded_at = transaction_timestamp()
  where id = '00000000-0000-4000-8000-000000005711';
  update public.communication_source_documents
  set status = 'processing'
  where id = '00000000-0000-4000-8000-000000005711';
  begin
    update public.communication_source_documents
    set status = 'review', checksum = repeat('a', 64), analyzed_at = transaction_timestamp()
    where id = '00000000-0000-4000-8000-000000005711';
  exception when unique_violation then
    duplicate_blocked := true;
  end;

  begin
    update public.communication_source_documents
    set original_name = 'renamed.pdf'
    where id = '00000000-0000-4000-8000-000000005711';
  exception when others then
    identity_change_blocked := true;
  end;

  begin
    update public.communication_source_documents
    set status = 'reserved'
    where id = '00000000-0000-4000-8000-000000005711';
  exception when others then
    invalid_transition_blocked := true;
  end;

  begin
    update public.communication_source_documents
    set status = 'used', extracted_text = null
    where id = '00000000-0000-4000-8000-000000005710';
  exception when check_violation then
    used_without_communication_blocked := true;
  end;

  begin
    update public.communication_source_documents
    set extracted_text = 'Interdit hors revue'
    where id = '00000000-0000-4000-8000-000000005711';
  exception when check_violation then
    text_outside_review_blocked := true;
  end;

  begin
    update public.communication_source_events
    set summary = '{"changed":true}'::jsonb
    where source_document_id = '00000000-0000-4000-8000-000000005710';
  exception when others then
    append_only_blocked := true;
  end;

  update public.communication_source_documents
  set status = 'rejected', extracted_text = null
  where id = '00000000-0000-4000-8000-000000005710';
  begin
    update public.communication_source_documents
    set analysis_error = 'mutation interdite'
    where id = '00000000-0000-4000-8000-000000005710';
  exception when others then
    final_mutation_blocked := true;
  end;

  if not (
    forged_initial_state_blocked and forged_actor_blocked and cross_scope_blocked
    and duplicate_blocked and identity_change_blocked and invalid_transition_blocked
    and used_without_communication_blocked and text_outside_review_blocked
    and append_only_blocked and final_mutation_blocked
  ) then
    raise exception 'Communication source security recipe failed';
  end if;
end;
$$;

rollback;

select
  (select count(*) from auth.users where id = '00000000-0000-4000-8000-000000005701') as auth_residue,
  (select count(*) from public.institutions where id in (
    '00000000-0000-4000-8000-000000005702',
    '00000000-0000-4000-8000-000000005703'
  )) as institution_residue,
  (select count(*) from public.communication_source_documents where id in (
    '00000000-0000-4000-8000-000000005710',
    '00000000-0000-4000-8000-000000005711'
  )) as source_residue,
  (select count(*) from public.communication_source_events where source_document_id in (
    '00000000-0000-4000-8000-000000005710',
    '00000000-0000-4000-8000-000000005711'
  )) as event_residue;
