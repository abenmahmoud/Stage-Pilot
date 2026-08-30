begin;

create or replace function public.communication_guard_publication_flag()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  settings_row public.communication_settings%rowtype;
begin
  if new.status = 'published' and old.status is distinct from new.status then
    select * into settings_row
    from public.communication_settings
    where institution_id = new.institution_id
    for key share;

    if settings_row.institution_id is null
      or not settings_row.module_enabled
      or not settings_row.publication_enabled then
      raise exception 'Communication publication is disabled';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.communication_guard_delivery_flags()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  settings_row public.communication_settings%rowtype;
begin
  select * into settings_row
  from public.communication_settings
  where institution_id = new.institution_id
  for key share;

  if settings_row.institution_id is null or not settings_row.module_enabled then
    raise exception 'Communication module is disabled';
  end if;

  if new.status not in ('prepared', 'cancelled')
    and not settings_row.sending_enabled then
    raise exception 'Communication sending is disabled';
  end if;
  return new;
end;
$$;

create or replace function public.communication_guard_job_flags()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  settings_row public.communication_settings%rowtype;
begin
  select * into settings_row
  from public.communication_settings
  where institution_id = new.institution_id
  for key share;

  if settings_row.institution_id is null or not settings_row.module_enabled then
    raise exception 'Communication module is disabled';
  end if;
  if new.job_type = 'publish' and not settings_row.publication_enabled then
    raise exception 'Communication publication is disabled';
  end if;
  if new.job_type in ('send_delivery', 'retry_delivery')
    and not settings_row.sending_enabled then
    raise exception 'Communication sending is disabled';
  end if;
  return new;
end;
$$;

create trigger communications_guard_publication_flag_trigger
before update on public.communications
for each row execute function public.communication_guard_publication_flag();

create trigger communication_deliveries_guard_flags_trigger
before insert or update on public.communication_deliveries
for each row execute function public.communication_guard_delivery_flags();

create trigger communication_jobs_guard_flags_trigger
before insert or update on public.communication_jobs
for each row execute function public.communication_guard_job_flags();

revoke all on function public.communication_guard_publication_flag() from public, anon, authenticated;
revoke all on function public.communication_guard_delivery_flags() from public, anon, authenticated;
revoke all on function public.communication_guard_job_flags() from public, anon, authenticated;

commit;
