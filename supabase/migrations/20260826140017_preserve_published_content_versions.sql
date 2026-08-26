begin;

alter table public.site_content_items
  add column published_version integer;

alter table public.site_content_items
  add constraint site_content_items_published_version_check check (
    published_version is null
    or (published_version > 0 and published_version <= version)
  );

alter table public.site_content_items
  drop constraint site_content_items_check1;

alter table public.site_content_items
  add constraint site_content_items_publication_check check (
    status <> 'publie'
    or (
      approved_by is not null
      and published_at is not null
      and published_version is not null
    )
  );

create index site_content_published_version_idx
  on public.site_content_items (published_version)
  where published_version is not null;

commit;
