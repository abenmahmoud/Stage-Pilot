begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000005961',
  'authenticated', 'authenticated', 'public-archive@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.site_content_items (
  id, content_type, slug, title, summary, body_markdown, category, audience,
  status, featured, publish_at, expires_at, published_at, created_by,
  updated_by, approved_by, version, published_version
) values
  (
    '00000000-0000-4000-8000-000000005962', 'article',
    'archive-preview-current', 'Information actuelle fictive', '',
    'Contenu actuel fictif.', 'Informations', 'tous', 'publie', true,
    transaction_timestamp() - interval '2 days',
    transaction_timestamp() + interval '1 day',
    transaction_timestamp() - interval '2 days',
    '00000000-0000-4000-8000-000000005961',
    '00000000-0000-4000-8000-000000005961',
    '00000000-0000-4000-8000-000000005961', 1, 1
  ),
  (
    '00000000-0000-4000-8000-000000005963', 'article',
    'archive-preview-expired', 'Information expirée fictive', '',
    'Contenu expiré fictif.', 'Informations', 'tous', 'publie', false,
    transaction_timestamp() - interval '3 days',
    transaction_timestamp() - interval '1 day',
    transaction_timestamp() - interval '3 days',
    '00000000-0000-4000-8000-000000005961',
    '00000000-0000-4000-8000-000000005961',
    '00000000-0000-4000-8000-000000005961', 1, 1
  ),
  (
    '00000000-0000-4000-8000-000000005964', 'article',
    'archive-preview-withdrawn', 'Information retirée fictive', '',
    'Ce contenu retiré ne doit jamais ressortir.', 'Informations', 'tous',
    'archive', false, transaction_timestamp() - interval '4 days',
    transaction_timestamp() - interval '2 days',
    transaction_timestamp() - interval '4 days',
    '00000000-0000-4000-8000-000000005961',
    '00000000-0000-4000-8000-000000005961',
    '00000000-0000-4000-8000-000000005961', 1, 1
  );

insert into public.site_content_versions (
  id, content_id, version, snapshot, created_by
) values
  (
    '00000000-0000-4000-8000-000000005972',
    '00000000-0000-4000-8000-000000005962', 1,
    jsonb_build_object(
      'contentType', 'article', 'slug', 'archive-preview-current',
      'title', 'Information actuelle fictive', 'summary', '',
      'bodyMarkdown', 'Contenu actuel fictif.', 'category', 'Informations',
      'audience', 'tous', 'templateId', null, 'featured', true,
      'metaTitle', null, 'metaDescription', null,
      'publishAt', transaction_timestamp() - interval '2 days',
      'expiresAt', transaction_timestamp() + interval '1 day',
      'status', 'publie', 'assets', '[]'::jsonb, 'version', 1
    ),
    '00000000-0000-4000-8000-000000005961'
  ),
  (
    '00000000-0000-4000-8000-000000005973',
    '00000000-0000-4000-8000-000000005963', 1,
    jsonb_build_object(
      'contentType', 'article', 'slug', 'archive-preview-expired',
      'title', 'Information expirée fictive', 'summary', '',
      'bodyMarkdown', 'Contenu expiré fictif.', 'category', 'Informations',
      'audience', 'tous', 'templateId', null, 'featured', false,
      'metaTitle', null, 'metaDescription', null,
      'publishAt', transaction_timestamp() - interval '3 days',
      'expiresAt', transaction_timestamp() - interval '1 day',
      'status', 'publie', 'assets', '[]'::jsonb, 'version', 1
    ),
    '00000000-0000-4000-8000-000000005961'
  ),
  (
    '00000000-0000-4000-8000-000000005974',
    '00000000-0000-4000-8000-000000005964', 1,
    jsonb_build_object(
      'contentType', 'article', 'slug', 'archive-preview-withdrawn',
      'title', 'Information retirée fictive', 'summary', '',
      'bodyMarkdown', 'Ce contenu retiré ne doit jamais ressortir.',
      'category', 'Informations', 'audience', 'tous', 'templateId', null,
      'featured', false, 'metaTitle', null, 'metaDescription', null,
      'publishAt', transaction_timestamp() - interval '4 days',
      'expiresAt', transaction_timestamp() - interval '2 days',
      'status', 'publie', 'assets', '[]'::jsonb, 'version', 1
    ),
    '00000000-0000-4000-8000-000000005961'
  );

do $$
declare
  current_ids uuid[];
  expired_ids uuid[];
begin
  select array_agg(item.id order by item.id) into current_ids
  from public.site_content_items item
  join public.site_content_versions version
    on version.content_id = item.id and version.version = item.published_version
  where item.id in (
      '00000000-0000-4000-8000-000000005962',
      '00000000-0000-4000-8000-000000005963',
      '00000000-0000-4000-8000-000000005964'
    )
    and item.published_version is not null
    and item.published_at is not null
    and item.status <> 'archive'
    and item.audience = 'tous'
    and (item.publish_at is null or item.publish_at <= transaction_timestamp())
    and (item.expires_at is null or item.expires_at > transaction_timestamp());

  select array_agg(item.id order by item.id) into expired_ids
  from public.site_content_items item
  join public.site_content_versions version
    on version.content_id = item.id and version.version = item.published_version
  where item.id in (
      '00000000-0000-4000-8000-000000005962',
      '00000000-0000-4000-8000-000000005963',
      '00000000-0000-4000-8000-000000005964'
    )
    and item.published_version is not null
    and item.published_at is not null
    and item.status <> 'archive'
    and item.audience = 'tous'
    and (item.publish_at is null or item.publish_at <= transaction_timestamp())
    and item.expires_at is not null
    and item.expires_at <= transaction_timestamp();

  if current_ids <> array['00000000-0000-4000-8000-000000005962'::uuid]
    or expired_ids <> array['00000000-0000-4000-8000-000000005963'::uuid]
  then
    raise exception 'Expired archive partition is not exclusive';
  end if;

  if has_table_privilege('anon', 'public.site_content_items', 'SELECT')
    or has_table_privilege('authenticated', 'public.site_content_items', 'SELECT')
    or has_table_privilege('anon', 'public.site_content_versions', 'SELECT')
    or has_table_privilege('authenticated', 'public.site_content_versions', 'SELECT')
  then
    raise exception 'Client roles must not read site content tables directly';
  end if;
end;
$$;

rollback;

select
  (select count(*) from auth.users
    where id = '00000000-0000-4000-8000-000000005961') as auth_residue,
  (select count(*) from public.site_content_items
    where id in (
      '00000000-0000-4000-8000-000000005962',
      '00000000-0000-4000-8000-000000005963',
      '00000000-0000-4000-8000-000000005964'
    )) as item_residue,
  (select count(*) from public.site_content_versions
    where content_id in (
      '00000000-0000-4000-8000-000000005962',
      '00000000-0000-4000-8000-000000005963',
      '00000000-0000-4000-8000-000000005964'
    )) as version_residue;
