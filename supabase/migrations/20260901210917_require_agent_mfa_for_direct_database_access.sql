begin;

-- Preserve existing row scopes and grants; MFA is an additional restriction.
do $$
declare
  table_name text;
  policy_expression text := $policy$
    (
      coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '')
        not in ('superadmin', 'administration', 'proviseur', 'agent')
      or coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
    )
  $policy$;
begin
  foreach table_name in array array[
    'classes', 'eleves', 'etablissement', 'fiches_grand_oral', 'import_logs',
    'notifications_log', 'professeurs', 'stages', 'templates_documents'
  ] loop
    if not exists (
      select 1 from pg_policies p
      join pg_class c on c.oid = to_regclass(format('public.%I', table_name))
      where p.schemaname = 'public' and p.tablename = table_name
        and p.policyname = 'agent_mfa_when_enrolled'
        and p.permissive = 'RESTRICTIVE' and p.cmd = 'ALL'
        and p.roles = array['authenticated']::name[] and c.relrowsecurity
    ) then
      raise exception 'Expected restrictive MFA policy missing on public.%', table_name;
    end if;

    execute format(
      'alter policy "agent_mfa_when_enrolled" on public.%I rename to "agent_mfa_required"',
      table_name
    );
    execute format(
      'alter policy "agent_mfa_required" on public.%I using (%s) with check (%s)',
      table_name, policy_expression, policy_expression
    );
  end loop;
end;
$$;

commit;
