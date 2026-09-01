begin;

create table public.schedule_page_assets (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  source_version_id uuid not null,
  page_number integer not null check (page_number between 1 and 500),
  storage_bucket text not null default 'schedule-ingest'
    check (storage_bucket = 'schedule-ingest'),
  storage_path text not null unique check (
    storage_path ~ '^page-assets/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{4}\.pdf$'
  ),
  mime_type text not null default 'application/pdf'
    check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes between 1 and 12582912),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, institution_id),
  foreign key (source_version_id, institution_id)
    references public.schedule_source_versions(id, institution_id) on delete cascade,
  constraint schedule_page_assets_source_page_uidx
    unique (source_version_id, page_number)
);

create index schedule_page_assets_source_institution_idx
  on public.schedule_page_assets (source_version_id, institution_id, page_number);

alter table public.schedule_page_assets enable row level security;
alter table public.schedule_page_assets force row level security;
revoke all on table public.schedule_page_assets from public, anon, authenticated;
grant select, insert, update, delete on table public.schedule_page_assets to service_role;

create function public.schedule_guard_page_asset_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate public.schedule_page_assets;
  source_status text;
  expected_path text;
begin
  candidate := case when tg_op = 'DELETE' then old else new end;
  select status into source_status
  from public.schedule_source_versions
  where id = candidate.source_version_id
    and institution_id = candidate.institution_id;

  if source_status is null and tg_op = 'DELETE' then
    return old;
  end if;
  if source_status is null then
    raise exception 'Schedule source is missing';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and source_status <> 'processing' then
    raise exception 'Schedule page assets are immutable outside processing';
  end if;
  if tg_op = 'DELETE' and source_status not in ('processing', 'rejected', 'failed', 'retired') then
    raise exception 'Schedule page assets cannot be removed from this source state';
  end if;

  expected_path := format(
    'page-assets/%s/%s/%s.pdf',
    lower(candidate.institution_id::text),
    lower(candidate.source_version_id::text),
    lpad(candidate.page_number::text, 4, '0')
  );
  if candidate.storage_path <> expected_path then
    raise exception 'Schedule page asset path does not match its scope';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.schedule_guard_page_asset_write()
from public, anon, authenticated;
grant execute on function public.schedule_guard_page_asset_write()
to service_role;

create trigger schedule_page_assets_guard_write
before insert or update or delete on public.schedule_page_assets
for each row execute function public.schedule_guard_page_asset_write();

create or replace function public.schedule_validate_source_promotion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  mapped_pages integer;
  verified_pages integer;
  generated_pages integer;
begin
  if old.status = new.status then
    return new;
  end if;

  if new.status = 'approved' and old.status <> 'review' then
    raise exception 'Schedule approval requires human review';
  end if;
  if new.status = 'active' and old.status not in ('approved', 'superseded') then
    raise exception 'Schedule activation requires approval or rollback';
  end if;
  if new.status = 'superseded' and old.status <> 'active' then
    raise exception 'Only an active schedule can be superseded';
  end if;

  if new.status in ('approved', 'active', 'superseded') then
    if new.checksum is null
      or new.page_count is null
      or (new.validation_summary ->> 'securityScan') is distinct from 'clean'
      or (new.validation_summary ->> 'pageCountVerified') is distinct from 'true'
      or (new.validation_summary ->> 'pageAssetsVerified') is distinct from 'true'
    then
      raise exception 'Schedule document validation is incomplete';
    end if;

    select
      count(*)::integer,
      count(*) filter (where review_status = 'verified')::integer
    into mapped_pages, verified_pages
    from public.schedule_page_indexes
    where source_version_id = new.id
      and institution_id = new.institution_id;

    select count(*)::integer
    into generated_pages
    from public.schedule_page_assets
    where source_version_id = new.id
      and institution_id = new.institution_id;

    if mapped_pages <> new.page_count or verified_pages <> new.page_count then
      raise exception 'Every schedule page must be mapped and verified';
    end if;
    if generated_pages <> new.page_count then
      raise exception 'Every schedule page must have a private page asset';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.schedule_validate_source_promotion()
from public, anon, authenticated;
grant execute on function public.schedule_validate_source_promotion()
to service_role;

commit;
