begin;

alter table public.schedule_source_versions
  add constraint schedule_source_versions_consecutive_school_year_check check (
    substring(school_year from 1 for 4)::integer + 1 =
      substring(school_year from 6 for 4)::integer
  );

create or replace function public.schedule_validate_page_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_kind text;
begin
  select source_kind into expected_kind
  from public.schedule_source_versions
  where id = new.source_version_id
    and institution_id = new.institution_id;

  if expected_kind is null then
    raise exception 'Schedule source version not found for institution';
  end if;
  if (expected_kind = 'classes' and new.subject_type <> 'class')
    or (expected_kind = 'teachers' and new.subject_type <> 'teacher')
  then
    raise exception 'Schedule page subject type does not match source kind';
  end if;
  return new;
end;
$$;

revoke all on function public.schedule_validate_page_scope() from public, anon, authenticated;
grant execute on function public.schedule_validate_page_scope() to service_role;

create trigger schedule_page_indexes_validate_scope
before insert or update of institution_id, source_version_id, subject_type
on public.schedule_page_indexes
for each row execute function public.schedule_validate_page_scope();

commit;
