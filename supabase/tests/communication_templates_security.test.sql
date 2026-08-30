begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000005601',
  'authenticated', 'authenticated', 'communication-template@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.institutions (id, slug, name, status) values
  ('00000000-0000-4000-8000-000000005602', 'communication-template-a', 'Template Preview A', 'draft'),
  ('00000000-0000-4000-8000-000000005603', 'communication-template-b', 'Template Preview B', 'draft');

insert into public.communication_templates (
  id, institution_id, template_key, label, default_category, title_hint,
  summary_hint, body_markdown, created_by, updated_by
) values (
  '00000000-0000-4000-8000-000000005610',
  '00000000-0000-4000-8000-000000005602',
  'hebdo', 'Hebdo fictif', 'information', 'Titre fictif',
  'Résumé fictif', '## Contenu fictif',
  '00000000-0000-4000-8000-000000005601',
  '00000000-0000-4000-8000-000000005601'
);

insert into public.communication_template_events (
  institution_id, template_id, event_type, actor_user_id, version, summary
) values (
  '00000000-0000-4000-8000-000000005602',
  '00000000-0000-4000-8000-000000005610',
  'template.customized', '00000000-0000-4000-8000-000000005601', 1,
  '{"templateKey":"hebdo"}'::jsonb
);

do $$
declare
  duplicate_blocked boolean := false;
  cross_scope_blocked boolean := false;
  identity_change_blocked boolean := false;
  version_skip_blocked boolean := false;
  append_only_blocked boolean := false;
begin
  begin
    insert into public.communication_templates (
      institution_id, template_key, label, default_category, body_markdown,
      created_by, updated_by
    ) values (
      '00000000-0000-4000-8000-000000005602', 'hebdo', 'Doublon',
      'information', 'Doublon fictif',
      '00000000-0000-4000-8000-000000005601',
      '00000000-0000-4000-8000-000000005601'
    );
  exception when unique_violation then
    duplicate_blocked := true;
  end;

  begin
    insert into public.communication_template_events (
      institution_id, template_id, event_type, actor_user_id, version
    ) values (
      '00000000-0000-4000-8000-000000005603',
      '00000000-0000-4000-8000-000000005610',
      'template.updated', '00000000-0000-4000-8000-000000005601', 1
    );
  exception when foreign_key_violation then
    cross_scope_blocked := true;
  end;

  begin
    update public.communication_templates
    set institution_id = '00000000-0000-4000-8000-000000005603', version = 2
    where id = '00000000-0000-4000-8000-000000005610';
  exception when others then
    identity_change_blocked := true;
  end;

  begin
    update public.communication_templates
    set label = 'Version sautée', version = 3
    where id = '00000000-0000-4000-8000-000000005610';
  exception when others then
    version_skip_blocked := true;
  end;

  update public.communication_templates
  set label = 'Hebdo fictif version 2', version = 2
  where id = '00000000-0000-4000-8000-000000005610';

  begin
    update public.communication_template_events
    set summary = '{"changed":true}'::jsonb
    where template_id = '00000000-0000-4000-8000-000000005610';
  exception when others then
    append_only_blocked := true;
  end;

  if not (
    duplicate_blocked and cross_scope_blocked and identity_change_blocked
    and version_skip_blocked and append_only_blocked
  ) then
    raise exception 'Communication template security recipe failed';
  end if;
end;
$$;

rollback;

select
  (select count(*) from auth.users where id = '00000000-0000-4000-8000-000000005601') as auth_residue,
  (select count(*) from public.institutions where id in (
    '00000000-0000-4000-8000-000000005602',
    '00000000-0000-4000-8000-000000005603'
  )) as institution_residue,
  (select count(*) from public.communication_templates where id = '00000000-0000-4000-8000-000000005610') as template_residue,
  (select count(*) from public.communication_template_events where template_id = '00000000-0000-4000-8000-000000005610') as event_residue;
