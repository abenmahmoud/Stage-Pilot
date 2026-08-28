-- Cache stable Auth values once per statement instead of recalculating them for
-- every row scanned by the legacy LyceeGest policies.
do $$
declare
  table_name text;
  policy_expression text := $policy$
    (
      coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '')
        not in ('superadmin', 'administration', 'proviseur')
      or coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1
        from auth.mfa_factors factor
        where factor.user_id = (select auth.uid())
          and factor.status = 'verified'
      )
    )
  $policy$;
begin
  foreach table_name in array array[
    'classes',
    'eleves',
    'etablissement',
    'fiches_grand_oral',
    'import_logs',
    'notifications_log',
    'professeurs',
    'stages',
    'templates_documents'
  ]
  loop
    execute format(
      'drop policy if exists "agent_mfa_when_enrolled" on public.%I',
      table_name
    );
    execute format(
      'create policy "agent_mfa_when_enrolled" on public.%I as restrictive for all to authenticated using (%s) with check (%s)',
      table_name,
      policy_expression,
      policy_expression
    );
  end loop;
end;
$$;
