begin;

alter table public.schedule_source_versions
  add column retired_by uuid references auth.users(id) on delete restrict,
  add column retirement_reason text,
  add column retention_policy_key text not null default 'pending_dpo'
    check (retention_policy_key in ('pending_dpo', 'approved')),
  add column retention_until timestamptz,
  add column storage_purge_status text not null default 'blocked'
    check (storage_purge_status in ('blocked', 'scheduled', 'purged', 'failed')),
  add column purged_at timestamptz,
  add constraint schedule_source_versions_retirement_fields_check check (
    (
      status = 'retired'
      and retired_by is not null
      and retired_at is not null
      and retirement_reason is not null
      and length(btrim(retirement_reason)) between 20 and 1000
    )
    or (
      status <> 'retired'
      and retired_by is null
      and retired_at is null
      and retirement_reason is null
    )
  ),
  add constraint schedule_source_versions_retention_state_check check (
    (
      retention_policy_key = 'pending_dpo'
      and retention_until is null
      and storage_purge_status = 'blocked'
      and purged_at is null
    )
    or (
      status = 'retired'
      and
      retention_policy_key = 'approved'
      and retention_until is not null
      and (
        (storage_purge_status in ('scheduled', 'failed') and purged_at is null)
        or (storage_purge_status = 'purged' and purged_at is not null)
      )
    )
  );

create index schedule_source_versions_retention_due_idx
  on public.schedule_source_versions (retention_until, created_at)
  where status = 'retired'
    and retention_policy_key = 'approved'
    and storage_purge_status in ('scheduled', 'failed');

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

  if old.status = 'retired' then
    raise exception 'A retired schedule source cannot be reactivated';
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
  if new.status = 'retired' then
    if old.status not in ('review', 'approved', 'superseded', 'rejected', 'failed') then
      raise exception 'This schedule source cannot be retired from its current state';
    end if;
    if new.retired_by is null
      or new.retired_at is null
      or length(btrim(new.retirement_reason)) not between 20 and 1000
      or new.retention_policy_key <> 'pending_dpo'
      or new.retention_until is not null
      or new.storage_purge_status <> 'blocked'
      or new.purged_at is not null
    then
      raise exception 'Schedule retirement governance is incomplete';
    end if;
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
