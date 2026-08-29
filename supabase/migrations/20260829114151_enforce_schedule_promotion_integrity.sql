begin;

alter table public.schedule_audit
  drop constraint schedule_audit_action_check;

alter table public.schedule_audit
  add constraint schedule_audit_action_check check (
    action in (
      'reserve_upload', 'confirm_upload', 'reject_upload', 'complete_scan',
      'index_page', 'verify_page', 'approve', 'activate', 'supersede',
      'rollback', 'open_page', 'retire'
    )
  );

create or replace function public.schedule_validate_source_promotion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  mapped_pages integer;
  verified_pages integer;
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
      or new.validation_summary ->> 'securityScan' <> 'clean'
      or new.validation_summary ->> 'pageCountVerified' <> 'true'
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

    if mapped_pages <> new.page_count or verified_pages <> new.page_count then
      raise exception 'Every schedule page must be mapped and verified';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.schedule_validate_source_promotion()
from public, anon, authenticated;
grant execute on function public.schedule_validate_source_promotion()
to service_role;

drop trigger if exists schedule_source_versions_validate_promotion
on public.schedule_source_versions;
create trigger schedule_source_versions_validate_promotion
before update of status on public.schedule_source_versions
for each row execute function public.schedule_validate_source_promotion();

commit;
