-- Run only on a verified disposable local database or the approved preview.
-- No Auth accounts, external actions or real rows. Every fixture is rolled back.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';

do $$
declare
  original_role text := current_user;
  policy_row record;
  app_role text;
  assurance text;
  claims jsonb;
  actor_id uuid := gen_random_uuid();
  class_id uuid := gen_random_uuid();
  candidate_id uuid;
  actual_using boolean;
  actual_check boolean;
  expected_access boolean;
  expected_write boolean;
  denied boolean;
  affected bigint;
  fixture_name text := 'TEST MFA RLS - ' || class_id::text;
  policy_checks integer := 0;
  crud_cases integer := 0;
begin
  if (select count(*) from pg_policies
      where schemaname = 'public' and policyname = 'agent_mfa_required') <> 9
    or exists (select 1 from pg_policies where schemaname = 'public'
      and policyname = 'agent_mfa_when_enrolled') then
    raise exception 'Expected nine migrated MFA policies';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated'
      and not rolbypassrls and not rolsuper) then
    raise exception 'authenticated must be subject to RLS';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.classes'::regclass
      and not tgisinternal) then
    raise exception 'Review class triggers before executing the synthetic fixture';
  end if;

  -- Evaluate the installed expressions, not a duplicate JavaScript policy.
  for policy_row in
    select p.*, c.relrowsecurity from pg_policies p
    join pg_class c on c.oid = to_regclass(format('public.%I', p.tablename))
    where p.schemaname = 'public' and p.policyname = 'agent_mfa_required'
  loop
    if policy_row.tablename not in (
        'classes', 'eleves', 'etablissement', 'fiches_grand_oral', 'import_logs',
        'notifications_log', 'professeurs', 'stages', 'templates_documents'
      ) or policy_row.permissive <> 'RESTRICTIVE' or policy_row.cmd <> 'ALL'
      or policy_row.roles <> array['authenticated']::name[]
      or not policy_row.relrowsecurity
      or policy_row.qual is null or policy_row.with_check is null then
      raise exception 'Unexpected MFA policy scope or mode';
    end if;
    foreach app_role in array array['superadmin', 'administration', 'proviseur', 'agent'] loop
      foreach assurance in array array['aal1', 'aal2', null, 'aal3', '']::text[] loop
        claims := jsonb_build_object('sub', actor_id, 'role', 'authenticated',
          'app_metadata', jsonb_build_object('role', app_role), 'aal', assurance,
          'user_metadata', jsonb_build_object('role', 'superadmin', 'aal', 'aal2'));
        perform set_config('request.jwt.claim.sub', '', true);
        perform set_config('request.jwt.claims', claims::text, true);
        execute 'set local role authenticated';
        execute format('select (%s), (%s)', policy_row.qual, policy_row.with_check)
          into actual_using, actual_check;
        execute format('set local role %I', original_role);
        expected_access := coalesce(assurance = 'aal2', false);
        if actual_using is distinct from expected_access
          or actual_check is distinct from expected_access then
          raise exception 'MFA predicate mismatch for % / %', app_role, assurance;
        end if;
        policy_checks := policy_checks + 2;
      end loop;
    end loop;
  end loop;

  insert into public.classes(id, nom, niveau, annee_scolaire)
    values (class_id, fixture_name, 'TEST', '2099-2100');

  -- Exercise real policies and grants, including roles that must not gain writes.
  foreach app_role in array array[
    'superadmin', 'administration', 'proviseur', 'agent', 'professeur', 'eleve', 'pp'
  ] loop
    foreach assurance in array array['aal1', 'aal2', null, 'aal3', '']::text[] loop
      candidate_id := gen_random_uuid();
      claims := jsonb_build_object('sub', actor_id, 'role', 'authenticated',
        'app_metadata', jsonb_build_object('role', app_role), 'aal', assurance,
        'user_metadata', jsonb_build_object('role', 'superadmin', 'aal', 'aal2'));
      perform set_config('request.jwt.claims', claims::text, true);
      execute 'set local role authenticated';
      if current_user <> 'authenticated' then
        raise exception 'Test must execute as authenticated, not the database owner';
      end if;
      expected_access := app_role in ('professeur', 'eleve', 'pp')
        or coalesce(assurance = 'aal2', false);
      expected_write := app_role in ('superadmin', 'administration')
        and coalesce(assurance = 'aal2', false);

      select count(*) into affected from public.classes where id = class_id;
      if affected <> (case when expected_access then 1 else 0 end) then
        raise exception 'Class SELECT mismatch for % / %', app_role, assurance;
      end if;

      denied := false;
      begin
        insert into public.classes(id, nom, niveau, annee_scolaire)
          values (candidate_id, 'TEST MFA RLS - ' || candidate_id::text, 'TEST', '2099-2100');
      exception when insufficient_privilege then
        denied := true;
      end;
      if denied is not distinct from expected_write then
        raise exception 'Class INSERT mismatch for % / %', app_role, assurance;
      end if;

      update public.classes set nom = fixture_name where id = class_id;
      get diagnostics affected = row_count;
      if affected <> (case when expected_write then 1 else 0 end) then
        raise exception 'Class UPDATE mismatch for % / %', app_role, assurance;
      end if;

      if expected_write then
        delete from public.classes where id = candidate_id;
      else
        delete from public.classes where id = class_id;
      end if;
      get diagnostics affected = row_count;
      if affected <> (case when expected_write then 1 else 0 end) then
        raise exception 'Class DELETE mismatch for % / %', app_role, assurance;
      end if;
      crud_cases := crud_cases + 1;
      execute format('set local role %I', original_role);
    end loop;
  end loop;

  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  begin
    select count(*) into affected from public.classes where id = class_id;
    if affected <> 0 then raise exception 'Anonymous class read was allowed'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.classes(id, nom, niveau, annee_scolaire)
      values (gen_random_uuid(), 'TEST MFA RLS - ' || gen_random_uuid()::text, 'TEST', '2099-2100');
    raise exception 'Anonymous class insert was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.classes set nom = fixture_name where id = class_id;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Anonymous class update was allowed'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.classes where id = class_id;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Anonymous class delete was allowed'; end if;
  exception when insufficient_privilege then null;
  end;
  execute format('set local role %I', original_role);

  -- The server role keeps its existing access; no new privilege is installed.
  execute 'set local role service_role';
  select count(*) into affected from public.classes where id = class_id;
  if affected <> 1 then raise exception 'Server access regressed'; end if;
  execute format('set local role %I', original_role);

  perform set_config('test.agent_mfa_result', jsonb_build_object(
    'status', 'passed', 'policies', 9, 'predicate_assertions', policy_checks,
    'class_crud_cases', crud_cases, 'anonymous_operations', 4,
    'server_read', true, 'auth_accounts_created', 0
  )::text, true);
end;
$$;

select current_setting('test.agent_mfa_result')::jsonb as result;
rollback;
