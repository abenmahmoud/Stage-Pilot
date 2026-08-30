begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000005901',
  'authenticated', 'authenticated', 'communication-publication@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.institutions (id, slug, name, status) values (
  '00000000-0000-4000-8000-000000005902',
  'communication-publication-preview', 'Publication Preview', 'draft'
);

insert into public.communication_settings (
  institution_id, module_enabled, publication_enabled, sending_enabled, updated_by
) values (
  '00000000-0000-4000-8000-000000005902', true, true, false,
  '00000000-0000-4000-8000-000000005901'
);

insert into public.communications (
  id, institution_id, source_type, source_fingerprint, source_label,
  category, created_by
) values
  (
    '00000000-0000-4000-8000-000000005910',
    '00000000-0000-4000-8000-000000005902',
    'direct_text', repeat('a', 64), 'Publication fictive réussie',
    'information',
    '00000000-0000-4000-8000-000000005901'
  ),
  (
    '00000000-0000-4000-8000-000000005920',
    '00000000-0000-4000-8000-000000005902',
    'direct_text', repeat('b', 64), 'Publication fictive annulée',
    'information',
    '00000000-0000-4000-8000-000000005901'
  );

insert into public.communication_versions (
  id, institution_id, communication_id, version, title, summary,
  body_markdown, structured_facts, open_questions, content_hash,
  created_by
) values
  (
    '00000000-0000-4000-8000-000000005911',
    '00000000-0000-4000-8000-000000005902',
    '00000000-0000-4000-8000-000000005910', 1,
    'Information fictive de rentrée', 'Résumé strictement fictif.',
    'Contenu strictement fictif, relu et validé.',
    '{"dates":[],"times":[],"places":[],"documents":[],"actions":[]}'::jsonb,
    '[]'::jsonb, repeat('c', 64),
    '00000000-0000-4000-8000-000000005901'
  ),
  (
    '00000000-0000-4000-8000-000000005921',
    '00000000-0000-4000-8000-000000005902',
    '00000000-0000-4000-8000-000000005920', 1,
    'Information fictive à annuler', 'Résumé strictement fictif.',
    'Cette publication fictive doit être intégralement annulée.',
    '{"dates":[],"times":[],"places":[],"documents":[],"actions":[]}'::jsonb,
    '[]'::jsonb, repeat('d', 64),
    '00000000-0000-4000-8000-000000005901'
  );

update public.communications
set visibility = 'public'
where id in (
  '00000000-0000-4000-8000-000000005910',
  '00000000-0000-4000-8000-000000005920'
);

update public.communication_versions
set status = 'review'
where id in (
  '00000000-0000-4000-8000-000000005911',
  '00000000-0000-4000-8000-000000005921'
);

update public.communications
set status = 'review'
where id in (
  '00000000-0000-4000-8000-000000005910',
  '00000000-0000-4000-8000-000000005920'
);

update public.communication_versions
set status = 'approved',
    approved_by = '00000000-0000-4000-8000-000000005901',
    approved_at = transaction_timestamp()
where id in (
  '00000000-0000-4000-8000-000000005911',
  '00000000-0000-4000-8000-000000005921'
);

update public.communications
set status = 'approved',
    approved_by = '00000000-0000-4000-8000-000000005901',
    approved_at = transaction_timestamp()
where id in (
  '00000000-0000-4000-8000-000000005910',
  '00000000-0000-4000-8000-000000005920'
);

do $$
declare
  publication_time timestamptz := transaction_timestamp();
  published_content_id uuid := '00000000-0000-4000-8000-000000005912';
  failed_content_id uuid := '00000000-0000-4000-8000-000000005922';
  forced_rollback_observed boolean := false;
  public_row_count integer;
begin
  insert into public.site_content_items (
    id, content_type, slug, title, summary, body_markdown, category, audience,
    status, featured, meta_title, meta_description, publish_at, published_at,
    import_key, needs_review, reviewed_at, reviewed_by, created_by, updated_by,
    approved_by, version, published_version
  ) values (
    published_content_id, 'article',
    'information-fictive-rentree-00000000',
    'Information fictive de rentrée', 'Résumé strictement fictif.',
    'Contenu strictement fictif, relu et validé.', 'Informations', 'tous',
    'publie', false, 'Information fictive de rentrée',
    'Résumé strictement fictif.', publication_time, publication_time,
    'communication:00000000-0000-4000-8000-000000005910', false,
    publication_time, '00000000-0000-4000-8000-000000005901',
    '00000000-0000-4000-8000-000000005901',
    '00000000-0000-4000-8000-000000005901',
    '00000000-0000-4000-8000-000000005901', 1, 1
  );

  insert into public.site_content_versions (
    id, content_id, version, snapshot, created_by
  ) values (
    '00000000-0000-4000-8000-000000005913', published_content_id, 1,
    jsonb_build_object(
      'contentType', 'article',
      'slug', 'information-fictive-rentree-00000000',
      'title', 'Information fictive de rentrée',
      'summary', 'Résumé strictement fictif.',
      'bodyMarkdown', 'Contenu strictement fictif, relu et validé.',
      'category', 'Informations',
      'audience', 'tous',
      'templateId', null,
      'featured', false,
      'metaTitle', 'Information fictive de rentrée',
      'metaDescription', 'Résumé strictement fictif.',
      'publishAt', publication_time,
      'expiresAt', null,
      'status', 'publie',
      'assets', '[]'::jsonb,
      'version', 1
    ),
    '00000000-0000-4000-8000-000000005901'
  );

  update public.communications
  set status = 'published',
      public_slug = 'information-fictive-rentree-00000000',
      site_content_id = published_content_id,
      published_at = publication_time
  where id = '00000000-0000-4000-8000-000000005910'
    and institution_id = '00000000-0000-4000-8000-000000005902'
    and status = 'approved'
    and current_version = 1;

  if not found then
    raise exception 'Approved communication was not published';
  end if;

  insert into public.site_content_audit (
    resource_type, resource_id, action, actor_id, summary
  ) values (
    'content', published_content_id, 'publish',
    '00000000-0000-4000-8000-000000005901',
    '{"source":"communication","communicationId":"00000000-0000-4000-8000-000000005910","version":1}'::jsonb
  );

  insert into public.communication_events (
    institution_id, communication_id, resource_type, resource_id,
    event_type, actor_user_id, actor_type, summary
  ) values (
    '00000000-0000-4000-8000-000000005902',
    '00000000-0000-4000-8000-000000005910',
    'communication', '00000000-0000-4000-8000-000000005910',
    'communication.published', '00000000-0000-4000-8000-000000005901',
    'user',
    '{"version":1,"siteContentId":"00000000-0000-4000-8000-000000005912"}'::jsonb
  );

  select count(*) into public_row_count
  from public.site_content_items item
  join public.site_content_versions version
    on version.content_id = item.id and version.version = item.published_version
  where item.id = published_content_id
    and item.status = 'publie'
    and item.audience = 'tous'
    and item.published_version = 1
    and item.published_at is not null
    and item.publish_at <= publication_time
    and (item.expires_at is null or item.expires_at > publication_time)
    and version.snapshot ->> 'status' = 'publie';

  if public_row_count <> 1
    or (select count(*) from public.site_content_audit
        where resource_id = published_content_id and action = 'publish') <> 1
    or (select count(*) from public.communication_events
        where communication_id = '00000000-0000-4000-8000-000000005910'
          and event_type = 'communication.published') <> 1
    or (select count(*) from public.communication_audiences
        where communication_id = '00000000-0000-4000-8000-000000005910') <> 0
    or (select count(*) from public.communication_deliveries
        where communication_id = '00000000-0000-4000-8000-000000005910') <> 0
    or (select count(*) from public.communication_jobs
        where communication_id = '00000000-0000-4000-8000-000000005910') <> 0
  then
    raise exception 'Atomic publication recipe failed';
  end if;

  begin
    insert into public.site_content_items (
      id, content_type, slug, title, summary, body_markdown, category, audience,
      status, publish_at, published_at, import_key, needs_review,
      reviewed_at, reviewed_by, created_by, updated_by, approved_by,
      version, published_version
    ) values (
      failed_content_id, 'article',
      'information-fictive-annulee-00000000',
      'Information fictive à annuler', 'Résumé strictement fictif.',
      'Cette publication fictive doit être intégralement annulée.',
      'Informations', 'tous', 'publie', publication_time, publication_time,
      'communication:00000000-0000-4000-8000-000000005920', false,
      publication_time, '00000000-0000-4000-8000-000000005901',
      '00000000-0000-4000-8000-000000005901',
      '00000000-0000-4000-8000-000000005901',
      '00000000-0000-4000-8000-000000005901', 1, 1
    );

    insert into public.site_content_versions (
      id, content_id, version, snapshot, created_by
    ) values (
      '00000000-0000-4000-8000-000000005923', failed_content_id, 1,
      '{"status":"publie","audience":"tous","version":1}'::jsonb,
      '00000000-0000-4000-8000-000000005901'
    );

    update public.communications
    set status = 'published',
        public_slug = 'information-fictive-annulee-00000000',
        site_content_id = failed_content_id,
        published_at = publication_time
    where id = '00000000-0000-4000-8000-000000005920';

    insert into public.site_content_audit (
      resource_type, resource_id, action, actor_id, summary
    ) values (
      'content', failed_content_id, 'publish',
      '00000000-0000-4000-8000-000000005901', '{}'
    );

    raise exception 'forced_publication_rollback';
  exception when others then
    forced_rollback_observed := sqlerrm = 'forced_publication_rollback';
  end;

  if not forced_rollback_observed
    or exists (select 1 from public.site_content_items where id = failed_content_id)
    or exists (select 1 from public.site_content_versions where content_id = failed_content_id)
    or exists (select 1 from public.site_content_audit where resource_id = failed_content_id)
    or exists (
      select 1 from public.communications
      where id = '00000000-0000-4000-8000-000000005920'
        and (status <> 'approved' or site_content_id is not null or published_at is not null)
    )
  then
    raise exception 'Failed publication left a partial state';
  end if;

  if has_table_privilege('anon', 'public.site_content_items', 'SELECT')
    or has_table_privilege('authenticated', 'public.site_content_items', 'SELECT')
    or has_table_privilege('anon', 'public.site_content_versions', 'SELECT')
    or has_table_privilege('authenticated', 'public.site_content_versions', 'SELECT')
    or has_table_privilege('anon', 'public.communications', 'SELECT')
    or has_table_privilege('authenticated', 'public.communications', 'SELECT')
  then
    raise exception 'Client roles must not read publication tables directly';
  end if;
end;
$$;

rollback;

select
  (select count(*) from auth.users
    where id = '00000000-0000-4000-8000-000000005901') as auth_residue,
  (select count(*) from public.institutions
    where id = '00000000-0000-4000-8000-000000005902') as institution_residue,
  (select count(*) from public.communications
    where id in (
      '00000000-0000-4000-8000-000000005910',
      '00000000-0000-4000-8000-000000005920'
    )) as communication_residue,
  (select count(*) from public.communication_versions
    where communication_id in (
      '00000000-0000-4000-8000-000000005910',
      '00000000-0000-4000-8000-000000005920'
    )) as communication_version_residue,
  (select count(*) from public.site_content_items
    where id in (
      '00000000-0000-4000-8000-000000005912',
      '00000000-0000-4000-8000-000000005922'
    )) as site_content_residue,
  (select count(*) from public.site_content_versions
    where content_id in (
      '00000000-0000-4000-8000-000000005912',
      '00000000-0000-4000-8000-000000005922'
    )) as site_version_residue,
  (select count(*) from public.site_content_audit
    where resource_id in (
      '00000000-0000-4000-8000-000000005912',
      '00000000-0000-4000-8000-000000005922'
    )) as site_audit_residue,
  (select count(*) from public.communication_events
    where communication_id in (
      '00000000-0000-4000-8000-000000005910',
      '00000000-0000-4000-8000-000000005920'
    )) as communication_event_residue;
