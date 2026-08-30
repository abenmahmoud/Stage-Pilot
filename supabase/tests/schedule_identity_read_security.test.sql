begin;

do $$
begin
  if to_regclass('public.schedule_source_versions') is null then
    raise exception 'schedule source versions table is missing';
  end if;
  if to_regclass('public.schedule_slots') is null then
    raise exception 'private schedule slots table is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'schedule_source_versions'
      and column_name = 'effective_until'
  ) then
    raise exception 'schedule validity end date is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'schedule_source_versions'
      and column_name = 'fresh_until'
  ) then
    raise exception 'schedule freshness limit is missing';
  end if;
  if not coalesce((
    select relrowsecurity and relforcerowsecurity
    from pg_class where oid = 'public.schedule_slots'::regclass
  ), false) then
    raise exception 'schedule slots must enable and force RLS';
  end if;
  if has_table_privilege('anon', 'public.schedule_slots', 'select')
    or has_table_privilege('authenticated', 'public.schedule_slots', 'select')
  then
    raise exception 'client roles must not read schedule slots directly';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.schedule_slots'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like
        'FOREIGN KEY (source_version_id, institution_id)%'
  ) then
    raise exception 'institution-scoped schedule source foreign key is missing';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'schedule_slots'
      and indexname = 'schedule_slots_source_identity_time_uidx'
  ) then
    raise exception 'scoped duplicate schedule index is missing';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.schedule_source_versions'::regclass
      and conname = 'schedule_source_versions_active_freshness_check'
      and convalidated
  ) then
    raise exception 'active schedule freshness constraint is not validated';
  end if;
  if not coalesce((
    select relrowsecurity and relforcerowsecurity
    from pg_class where oid = 'public.identity_directory_rows'::regclass
  ), false) then
    raise exception 'identity directory rows must enable and force RLS';
  end if;
  if has_table_privilege('authenticated', 'public.identity_directory_rows', 'select') then
    raise exception 'authenticated must not read identity directory rows directly';
  end if;
end
$$;

rollback;
