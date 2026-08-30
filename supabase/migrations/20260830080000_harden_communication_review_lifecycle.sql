begin;

create or replace function public.communication_guard_root()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_version_status text;
begin
  if new.institution_id <> old.institution_id
    or new.source_type <> old.source_type
    or new.source_fingerprint <> old.source_fingerprint
    or new.source_label <> old.source_label
    or new.source_received_at <> old.source_received_at
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'Communication source and scope are immutable';
  end if;
  if new.current_version <> old.current_version then
    if old.status <> 'draft' or new.current_version <> old.current_version + 1 then
      raise exception 'Communication version pointer may advance once while drafting';
    end if;
  end if;
  if old.status <> 'draft' and (
    new.visibility <> old.visibility
    or new.category <> old.category
    or new.template_key is distinct from old.template_key
  ) then
    raise exception 'Communication review metadata is immutable';
  end if;
  if not (
    (old.status = 'draft' and new.status in ('draft', 'review', 'cancelled'))
    or (old.status = 'review' and new.status in ('review', 'approved', 'cancelled'))
    or (old.status = 'approved' and new.status in ('approved', 'published', 'archived', 'cancelled'))
    or (old.status = 'published' and new.status in ('published', 'archived'))
    or (old.status = 'archived' and new.status = 'archived')
    or (old.status = 'cancelled' and new.status = 'cancelled')
  ) then
    raise exception 'Invalid communication lifecycle transition';
  end if;
  if old.approved_at is not null and (
    new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
  ) then
    raise exception 'Communication approval identity is immutable';
  end if;
  if new.status in ('draft', 'review', 'approved', 'published') then
    select status into current_version_status
    from public.communication_versions
    where communication_id = new.id
      and institution_id = new.institution_id
      and version = new.current_version;
    if current_version_status is null or not (
      (new.status = 'draft' and current_version_status = 'draft')
      or (new.status = 'review' and current_version_status = 'review')
      or (new.status in ('approved', 'published') and current_version_status in ('approved', 'published'))
    ) then
      raise exception 'Communication and current version states are inconsistent';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.communication_guard_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  root_current_version integer;
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then
    raise exception 'Validated communication versions are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
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
  current_version_status text;
begin
  root_id := case when tg_table_name = 'communications' then new.id else new.communication_id end;
  select c.status, v.status
  into root_status, current_version_status
  from public.communications c
  left join public.communication_versions v
    on v.communication_id = c.id
   and v.institution_id = c.institution_id
   and v.version = c.current_version
  where c.id = root_id;
  if root_status in ('draft', 'review', 'approved', 'published') and not (
    (root_status = 'draft' and current_version_status = 'draft')
    or (root_status = 'review' and current_version_status = 'review')
    or (root_status in ('approved', 'published') and current_version_status in ('approved', 'published'))
  ) then
    raise exception 'Communication and current version states are inconsistent';
  end if;
  return new;
end;
$$;

create or replace function public.communication_root_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'draft'
    or new.visibility <> 'internal'
    or new.current_version <> 1
    or new.public_slug is not null
    or new.site_content_id is not null
    or new.approved_by is not null
    or new.approved_at is not null
    or new.publish_at is not null
    or new.expires_at is not null
    or new.published_at is not null
    or new.archived_at is not null then
    raise exception 'Communication must start as a private draft';
  end if;
  return new;
end;
$$;

create or replace function public.communication_version_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  root_current_version integer;
  root_status text;
begin
  if new.status <> 'draft'
    or new.approved_by is not null
    or new.approved_at is not null then
    raise exception 'Communication version must start as a draft';
  end if;
  select current_version, status
  into root_current_version, root_status
  from public.communications
  where id = new.communication_id and institution_id = new.institution_id
  for key share;
  if root_status <> 'draft'
    or new.version not in (root_current_version, root_current_version + 1) then
    raise exception 'Communication version sequence is invalid';
  end if;
  return new;
end;
$$;

drop trigger if exists communication_root_insert_guard_trigger on public.communications;
create trigger communication_root_insert_guard_trigger
before insert on public.communications
for each row execute function public.communication_root_insert_guard();

drop trigger if exists communication_version_insert_guard_trigger on public.communication_versions;
create trigger communication_version_insert_guard_trigger
before insert on public.communication_versions
for each row execute function public.communication_version_insert_guard();

drop trigger if exists communication_current_version_from_root_trigger on public.communications;
create constraint trigger communication_current_version_from_root_trigger
after insert or update on public.communications
deferrable initially deferred
for each row execute function public.communication_assert_current_version_consistency();

drop trigger if exists communication_current_version_from_version_trigger on public.communication_versions;
create constraint trigger communication_current_version_from_version_trigger
after insert or update on public.communication_versions
deferrable initially deferred
for each row execute function public.communication_assert_current_version_consistency();

revoke all on function public.communication_guard_root() from public, anon, authenticated;
revoke all on function public.communication_guard_version() from public, anon, authenticated;
revoke all on function public.communication_root_insert_guard() from public, anon, authenticated;
revoke all on function public.communication_version_insert_guard() from public, anon, authenticated;
revoke all on function public.communication_assert_current_version_consistency() from public, anon, authenticated;

commit;
