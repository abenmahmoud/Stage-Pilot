begin;

create or replace function public.communication_guard_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  root_current_version integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'Communication versions are retained';
  end if;
  if new.institution_id <> old.institution_id
    or new.communication_id <> old.communication_id
    or new.version <> old.version
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'Communication version scope is immutable';
  end if;
  if old.status in ('approved', 'published', 'superseded') then
    raise exception 'Validated communication versions are immutable';
  end if;
  if old.status = 'review' and (
    new.title <> old.title
    or new.summary <> old.summary
    or new.body_markdown <> old.body_markdown
    or new.structured_facts <> old.structured_facts
    or new.open_questions <> old.open_questions
    or new.content_hash <> old.content_hash
  ) then
    raise exception 'Communication review content is immutable';
  end if;
  if new.status <> old.status then
    select current_version into root_current_version
    from public.communications
    where id = new.communication_id and institution_id = new.institution_id;
    if root_current_version <> new.version then
      raise exception 'Only the current communication version may change state';
    end if;
  end if;
  if not (
    (old.status = 'draft' and new.status in ('draft', 'review'))
    or (old.status = 'review' and new.status in ('review', 'approved'))
  ) then
    raise exception 'Invalid communication version lifecycle transition';
  end if;
  return new;
end;
$$;

create or replace function public.communication_assert_current_version_consistency()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  root_id uuid;
  root_status text;
  root_current_version integer;
  current_version_status text;
begin
  if tg_table_name = 'communications' then
    root_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    root_id := case when tg_op = 'DELETE' then old.communication_id else new.communication_id end;
  end if;
  select c.status, c.current_version, v.status
  into root_status, root_current_version, current_version_status
  from public.communications c
  left join public.communication_versions v
    on v.communication_id = c.id
   and v.institution_id = c.institution_id
   and v.version = c.current_version
  where c.id = root_id;
  if tg_table_name = 'communication_versions'
    and tg_op <> 'DELETE'
    and new.version > root_current_version then
    raise exception 'Communication version must become current in the same transaction';
  end if;
  if root_status in ('draft', 'review', 'approved', 'published') and not (
    (root_status = 'draft' and current_version_status = 'draft')
    or (root_status = 'review' and current_version_status = 'review')
    or (root_status in ('approved', 'published') and current_version_status in ('approved', 'published'))
  ) then
    raise exception 'Communication and current version states are inconsistent';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.communication_guard_version() from public, anon, authenticated;
revoke all on function public.communication_assert_current_version_consistency() from public, anon, authenticated;

commit;
