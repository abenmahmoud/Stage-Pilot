begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000005801',
  'authenticated', 'authenticated', 'communication-review@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.institutions (id, slug, name, status) values (
  '00000000-0000-4000-8000-000000005802',
  'communication-review-a', 'Review Preview A', 'draft'
);

insert into public.communications (
  id, institution_id, source_type, source_fingerprint, source_label,
  category, created_by
) values (
  '00000000-0000-4000-8000-000000005810',
  '00000000-0000-4000-8000-000000005802',
  'direct_text', repeat('a', 64), 'Saisie fictive',
  'information', '00000000-0000-4000-8000-000000005801'
);

insert into public.communication_versions (
  id, institution_id, communication_id, version, title, summary,
  body_markdown, structured_facts, open_questions, content_hash, created_by
) values (
  '00000000-0000-4000-8000-000000005811',
  '00000000-0000-4000-8000-000000005802',
  '00000000-0000-4000-8000-000000005810', 1,
  'Information fictive', 'Résumé fictif', 'Contenu fictif version 1.',
  '{"dates":[],"times":[],"places":[],"documents":[],"actions":[]}'::jsonb,
  '[]'::jsonb, repeat('b', 64), '00000000-0000-4000-8000-000000005801'
);

do $$
declare
  forged_root_blocked boolean := false;
  forged_version_blocked boolean := false;
  version_skip_blocked boolean := false;
  detached_version_blocked boolean := false;
  pointer_skip_blocked boolean := false;
  review_content_blocked boolean := false;
  review_metadata_blocked boolean := false;
  review_version_insert_blocked boolean := false;
  invalid_root_transition_blocked boolean := false;
  invalid_version_transition_blocked boolean := false;
  version_delete_blocked boolean := false;
begin
  begin
    insert into public.communications (
      institution_id, source_type, source_fingerprint, source_label,
      status, category, created_by
    ) values (
      '00000000-0000-4000-8000-000000005802', 'direct_text', repeat('c', 64),
      'Source forgée', 'review', 'information',
      '00000000-0000-4000-8000-000000005801'
    );
  exception when others then
    forged_root_blocked := true;
  end;

  begin
    insert into public.communication_versions (
      institution_id, communication_id, version, status, title, body_markdown,
      content_hash, created_by
    ) values (
      '00000000-0000-4000-8000-000000005802',
      '00000000-0000-4000-8000-000000005810', 2, 'review',
      'Version forgée', 'Contenu forgé', repeat('d', 64),
      '00000000-0000-4000-8000-000000005801'
    );
  exception when others then
    forged_version_blocked := true;
  end;

  begin
    insert into public.communication_versions (
      institution_id, communication_id, version, title, body_markdown,
      content_hash, created_by
    ) values (
      '00000000-0000-4000-8000-000000005802',
      '00000000-0000-4000-8000-000000005810', 3,
      'Version sautée', 'Contenu sauté', repeat('e', 64),
      '00000000-0000-4000-8000-000000005801'
    );
  exception when others then
    version_skip_blocked := true;
  end;

  begin
    insert into public.communication_versions (
      institution_id, communication_id, version, title, body_markdown,
      content_hash, created_by
    ) values (
      '00000000-0000-4000-8000-000000005802',
      '00000000-0000-4000-8000-000000005810', 2,
      'Version détachée', 'Cette version ne devient pas courante.', repeat('2', 64),
      '00000000-0000-4000-8000-000000005801'
    );
    set constraints all immediate;
  exception when others then
    detached_version_blocked := true;
  end;

  insert into public.communication_versions (
    id, institution_id, communication_id, version, title, summary,
    body_markdown, structured_facts, open_questions, content_hash, created_by
  ) values (
    '00000000-0000-4000-8000-000000005812',
    '00000000-0000-4000-8000-000000005802',
    '00000000-0000-4000-8000-000000005810', 2,
    'Information fictive v2', 'Résumé fictif v2', 'Contenu fictif version 2.',
    '{"dates":["2 septembre"],"times":[],"places":[],"documents":[],"actions":[]}'::jsonb,
    '[]'::jsonb, repeat('f', 64), '00000000-0000-4000-8000-000000005801'
  );
  update public.communications set current_version = 2
  where id = '00000000-0000-4000-8000-000000005810';

  begin
    update public.communications set current_version = 4
    where id = '00000000-0000-4000-8000-000000005810';
  exception when others then
    pointer_skip_blocked := true;
  end;

  update public.communication_versions set status = 'review'
  where id = '00000000-0000-4000-8000-000000005812';
  update public.communications set status = 'review'
  where id = '00000000-0000-4000-8000-000000005810';

  begin
    update public.communication_versions set body_markdown = 'Mutation interdite'
    where id = '00000000-0000-4000-8000-000000005812';
  exception when others then
    review_content_blocked := true;
  end;

  begin
    update public.communications set category = 'urgent'
    where id = '00000000-0000-4000-8000-000000005810';
  exception when others then
    review_metadata_blocked := true;
  end;

  begin
    insert into public.communication_versions (
      institution_id, communication_id, version, title, body_markdown,
      content_hash, created_by
    ) values (
      '00000000-0000-4000-8000-000000005802',
      '00000000-0000-4000-8000-000000005810', 3,
      'Pendant revue', 'Interdit pendant revue', repeat('1', 64),
      '00000000-0000-4000-8000-000000005801'
    );
  exception when others then
    review_version_insert_blocked := true;
  end;

  begin
    update public.communications set status = 'archived'
    where id = '00000000-0000-4000-8000-000000005810';
  exception when others then
    invalid_root_transition_blocked := true;
  end;

  begin
    update public.communication_versions set status = 'published'
    where id = '00000000-0000-4000-8000-000000005812';
  exception when others then
    invalid_version_transition_blocked := true;
  end;

  begin
    delete from public.communication_versions
    where id = '00000000-0000-4000-8000-000000005811';
  exception when others then
    version_delete_blocked := true;
  end;

  if not (
    forged_root_blocked and forged_version_blocked and version_skip_blocked
    and detached_version_blocked
    and pointer_skip_blocked and review_content_blocked and review_metadata_blocked
    and review_version_insert_blocked and invalid_root_transition_blocked
    and invalid_version_transition_blocked and version_delete_blocked
  ) then
    raise exception 'Communication review lifecycle security recipe failed';
  end if;
end;
$$;

rollback;

select
  (select count(*) from auth.users where id = '00000000-0000-4000-8000-000000005801') as auth_residue,
  (select count(*) from public.institutions where id = '00000000-0000-4000-8000-000000005802') as institution_residue,
  (select count(*) from public.communications where id = '00000000-0000-4000-8000-000000005810') as communication_residue,
  (select count(*) from public.communication_versions where communication_id = '00000000-0000-4000-8000-000000005810') as version_residue;
