begin;

create or replace function public.communication_guard_delivery_flags()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  settings_row public.communication_settings%rowtype;
begin
  if tg_op = 'UPDATE'
    and old.status in ('prepared', 'queued', 'error')
    and new.status = 'cancelled'
  then
    return new;
  end if;

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
  if tg_op = 'UPDATE'
    and old.status in ('pending', 'retry')
    and new.status = 'cancelled'
  then
    return new;
  end if;

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

revoke all on function public.communication_guard_delivery_flags() from public, anon, authenticated;
revoke all on function public.communication_guard_job_flags() from public, anon, authenticated;

comment on function public.communication_guard_delivery_flags() is
  'Fail-closed communication switch guard; only a pre-send transition to cancelled remains available during an outage.';
comment on function public.communication_guard_job_flags() is
  'Fail-closed communication switch guard; only pending or retry work may transition to cancelled during an outage.';

commit;
