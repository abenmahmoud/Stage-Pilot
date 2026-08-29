begin;

create or replace function public.schedule_validate_page_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_kind text;
  expected_page_count integer;
  source_status text;
begin
  select source_kind, page_count, status
  into expected_kind, expected_page_count, source_status
  from public.schedule_source_versions
  where id = new.source_version_id
    and institution_id = new.institution_id;

  if expected_kind is null then
    raise exception 'Schedule source version not found for institution';
  end if;
  if source_status <> 'review' then
    raise exception 'Schedule page indexes are editable only during human review';
  end if;
  if expected_page_count is null or new.page_number > expected_page_count then
    raise exception 'Schedule page number exceeds verified PDF page count';
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

drop trigger if exists schedule_page_indexes_validate_scope on public.schedule_page_indexes;
create trigger schedule_page_indexes_validate_scope
before insert or update of institution_id, source_version_id, page_number,
  subject_type, subject_ref, review_status
on public.schedule_page_indexes
for each row execute function public.schedule_validate_page_scope();

commit;
