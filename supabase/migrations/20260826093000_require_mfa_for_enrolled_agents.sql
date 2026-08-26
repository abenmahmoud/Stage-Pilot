-- Once an agent enrolls MFA, direct database access also requires an aal2 JWT.
-- Agents without a verified factor keep access during the staged rollout.
create or replace function public.agent_mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
      not in ('superadmin', 'administration', 'proviseur') then true
    when coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then true
    else not exists (
      select 1
      from auth.mfa_factors factor
      where factor.user_id = auth.uid()
        and factor.status = 'verified'
    )
  end;
$$;

revoke all on function public.agent_mfa_satisfied() from public;
grant execute on function public.agent_mfa_satisfied() to authenticated;

do $$
declare
  table_name text;
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
      'create policy "agent_mfa_when_enrolled" on public.%I as restrictive for all to authenticated using ((select public.agent_mfa_satisfied())) with check ((select public.agent_mfa_satisfied()))',
      table_name
    );
  end loop;
end;
$$;
