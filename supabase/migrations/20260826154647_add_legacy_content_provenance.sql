begin;

alter table public.site_content_items
  add column source_system text,
  add column source_url text,
  add column source_updated_at timestamptz,
  add column import_key text,
  add column source_disposition text,
  add column needs_review boolean not null default false,
  add column imported_at timestamptz,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users(id) on delete set null;

alter table public.site_content_items
  add constraint site_content_items_source_system_check check (
    source_system is null or source_system in ('wordpress')
  ),
  add constraint site_content_items_source_url_check check (
    source_url is null or char_length(source_url) <= 1000
  ),
  add constraint site_content_items_import_key_check check (
    import_key is null or char_length(import_key) between 3 and 180
  ),
  add constraint site_content_items_source_disposition_check check (
    source_disposition is null or source_disposition in ('durable', 'archive', 'a_confirmer')
  ),
  add constraint site_content_items_review_consistency_check check (
    (reviewed_at is null and reviewed_by is null)
    or (reviewed_at is not null and reviewed_by is not null)
  );

create unique index site_content_items_import_key_unique
  on public.site_content_items (import_key)
  where import_key is not null;

create index site_content_items_review_queue_idx
  on public.site_content_items (needs_review, source_disposition, updated_at desc)
  where needs_review;

alter table public.site_content_assets
  add column source_system text,
  add column source_url text,
  add column import_key text;

alter table public.site_content_assets
  add constraint site_content_assets_source_system_check check (
    source_system is null or source_system in ('wordpress')
  ),
  add constraint site_content_assets_source_url_check check (
    source_url is null or char_length(source_url) <= 1000
  ),
  add constraint site_content_assets_import_key_check check (
    import_key is null or char_length(import_key) between 3 and 180
  );

create unique index site_content_assets_import_key_unique
  on public.site_content_assets (import_key)
  where import_key is not null;

alter table public.site_content_audit
  drop constraint site_content_audit_action_check;

alter table public.site_content_audit
  add constraint site_content_audit_action_check check (
    action in (
      'create', 'update', 'submit_review', 'publish', 'archive', 'duplicate',
      'restore', 'upload', 'confirm_upload', 'legacy_import', 'verify_source'
    )
  );

commit;
