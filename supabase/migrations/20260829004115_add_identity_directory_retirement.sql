begin;

alter table public.identity_directory_imports
  drop constraint if exists identity_directory_imports_status_check;

alter table public.identity_directory_imports
  add column retired_by uuid references auth.users(id) on delete restrict,
  add column retired_at timestamptz,
  add column retirement_reason text,
  add constraint identity_directory_imports_status_check check (
    status in (
      'reserved', 'uploaded', 'quarantined', 'parsing', 'review',
      'approved', 'active', 'superseded', 'rejected', 'failed', 'retired'
    )
  ),
  add constraint identity_directory_imports_retirement_check check (
    status <> 'retired'
    or (
      retired_by is not null
      and retired_at is not null
      and length(btrim(retirement_reason)) between 20 and 1000
    )
  );

create index identity_directory_imports_retired_by_idx
  on public.identity_directory_imports (retired_by)
  where retired_by is not null;

alter table public.identity_directory_audit
  drop constraint if exists identity_directory_audit_action_check;

alter table public.identity_directory_audit
  add constraint identity_directory_audit_action_check check (
    action in (
      'reserve_upload', 'confirm_upload', 'reject_upload', 'queue_scan',
      'complete_parse', 'approve', 'activate', 'supersede', 'retire', 'revoke',
      'verify_contact', 'link_identity', 'link_relationship'
    )
  );

create or replace function public.identity_directory_require_active_source()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.identity_directory_imports source_import
    where source_import.id = new.source_import_id
      and source_import.institution_id = new.institution_id
      and source_import.status = 'active'
  ) then
    raise exception 'identity directory source must be active'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.identity_directory_require_active_source() from public;
grant execute on function public.identity_directory_require_active_source() to service_role;

create trigger school_identities_require_active_source
before insert or update of source_import_id, institution_id
on public.school_identities
for each row execute function public.identity_directory_require_active_source();

create trigger school_relationships_require_active_source
before insert or update of source_import_id, institution_id
on public.school_relationships
for each row execute function public.identity_directory_require_active_source();

comment on column public.identity_directory_imports.retirement_reason is
  'Human justification retained after the private file and quarantine rows are removed.';

commit;
