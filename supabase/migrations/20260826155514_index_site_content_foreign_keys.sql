begin;

create index site_content_asset_links_asset_idx
  on public.site_content_asset_links (asset_id);
create index site_content_assets_creator_idx
  on public.site_content_assets (created_by)
  where created_by is not null;
create index site_content_audit_actor_idx
  on public.site_content_audit (actor_id)
  where actor_id is not null;
create index site_content_items_approved_by_idx
  on public.site_content_items (approved_by)
  where approved_by is not null;
create index site_content_items_created_by_idx
  on public.site_content_items (created_by)
  where created_by is not null;
create index site_content_items_reviewed_by_idx
  on public.site_content_items (reviewed_by)
  where reviewed_by is not null;
create index site_content_items_template_idx
  on public.site_content_items (template_id)
  where template_id is not null;
create index site_content_items_updated_by_idx
  on public.site_content_items (updated_by)
  where updated_by is not null;
create index site_content_templates_created_by_idx
  on public.site_content_templates (created_by)
  where created_by is not null;
create index site_content_templates_updated_by_idx
  on public.site_content_templates (updated_by)
  where updated_by is not null;
create index site_content_versions_created_by_idx
  on public.site_content_versions (created_by)
  where created_by is not null;

commit;
