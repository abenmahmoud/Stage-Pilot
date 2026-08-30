begin;

create or replace function public.communication_guard_delivery_flags()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  settings_row public.communication_settings%rowtype;
  communication_status text;
  version_status text;
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

  select communication.status, version.status
    into communication_status, version_status
  from public.communications communication
  join public.communication_versions version
    on version.id = new.version_id
   and version.institution_id = new.institution_id
   and version.communication_id = new.communication_id
   and version.version = new.version
  where communication.id = new.communication_id
    and communication.institution_id = new.institution_id
  for key share of communication, version;

  if communication_status not in ('approved', 'published')
    or version_status not in ('approved', 'published') then
    raise exception 'Communication delivery requires an approved version';
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
  communication_status text;
  version_status text;
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

  if new.job_type in ('publish', 'prepare_delivery', 'send_delivery', 'retry_delivery') then
    select communication.status, version.status
      into communication_status, version_status
    from public.communications communication
    join public.communication_versions version
      on version.id = new.version_id
     and version.institution_id = new.institution_id
     and version.communication_id = new.communication_id
     and version.version = new.version
    where communication.id = new.communication_id
      and communication.institution_id = new.institution_id
    for key share of communication, version;

    if communication_status not in ('approved', 'published')
      or version_status not in ('approved', 'published') then
      raise exception 'Communication job requires an approved version';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.communication_guard_delivery_flags() from public, anon, authenticated;
revoke all on function public.communication_guard_job_flags() from public, anon, authenticated;

comment on function public.communication_guard_delivery_flags() is
  'Fail-closed communication guard preserving approval checks while allowing only pre-send emergency cancellation.';
comment on function public.communication_guard_job_flags() is
  'Fail-closed communication guard preserving approval checks while allowing only pending or retry emergency cancellation.';

commit;
