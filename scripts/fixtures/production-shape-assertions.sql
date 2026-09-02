do $$
declare
  actual_count bigint;
  migration_count bigint;
  rehearsal jsonb;
begin
  select count(*) into actual_count from public.classes;
  if actual_count <> 44 then
    raise exception 'Expected 44 synthetic classes, got %', actual_count;
  end if;

  select count(*) into actual_count from public.professeurs;
  if actual_count <> 106 then
    raise exception 'Expected 106 synthetic staff rows, got %', actual_count;
  end if;

  select count(*) into actual_count from public.eleves;
  if actual_count <> 1159 then
    raise exception 'Expected 1159 synthetic students, got %', actual_count;
  end if;

  select count(*) into actual_count from public.stages;
  if actual_count <> 1159 then
    raise exception 'Expected 1159 synthetic placements, got %', actual_count;
  end if;

  select count(*) into actual_count from public.fiches_grand_oral;
  if actual_count <> 2 then
    raise exception 'Expected 2 synthetic oral records, got %', actual_count;
  end if;

  select count(*) into actual_count from public.import_logs;
  if actual_count <> 2 then
    raise exception 'Expected 2 synthetic import logs, got %', actual_count;
  end if;

  select count(*) into actual_count from public.notifications_log;
  if actual_count <> 0 then
    raise exception 'Expected no synthetic notification, got %', actual_count;
  end if;

  select count(*) into actual_count from public.templates_documents;
  if actual_count <> 6 then
    raise exception 'Expected 6 synthetic templates, got %', actual_count;
  end if;

  select count(*) into migration_count
  from supabase_migrations.schema_migrations;
  if migration_count <> 94 then
    raise exception 'Expected 94 migration versions, got %', migration_count;
  end if;

  if to_regclass('public.support_requests') is null
    or to_regclass('public.site_content_items') is null
    or to_regclass('public.institutions') is null
    or to_regclass('public.institution_memberships') is null
    or to_regclass('public.knowledge_documents') is null then
    raise exception 'One or more pilot tables are missing after migration';
  end if;

  if exists (
    select 1
    from public.professeurs
    where email is not null and email not like '%@example.test'
  ) or exists (
    select 1
    from public.eleves
    where email_eleve is not null and email_eleve not like '%@example.test'
  ) then
    raise exception 'Fixture contains a non-example email';
  end if;

  if exists (
    select 1 from public.professeurs where code_acces not like 'SYN-PROF-%'
  ) or exists (
    select 1 from public.eleves where code_acces not like 'SYN-ELEVE-%'
  ) then
    raise exception 'Fixture contains a non-synthetic legacy access code';
  end if;

  rehearsal := jsonb_build_object(
    'target', 'local_synthetic_production_shape',
    'migrations', migration_count,
    'classes', (select count(*) from public.classes),
    'staff', (select count(*) from public.professeurs),
    'students', (select count(*) from public.eleves),
    'placements', (select count(*) from public.stages),
    'real_data', false
  );
  raise notice 'migration_rehearsal=%', rehearsal::text;
end
$$;
