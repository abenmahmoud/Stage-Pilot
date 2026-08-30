begin;

create or replace function public.communication_guard_audience_scope()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  communication_status text;
begin
  select status into communication_status
  from public.communications
  where id = case when tg_op = 'DELETE' then old.communication_id else new.communication_id end
    and institution_id = case when tg_op = 'DELETE' then old.institution_id else new.institution_id end
  for key share;

  if communication_status not in ('draft', 'review') then
    raise exception 'Validated communication audiences are immutable';
  end if;
  if tg_op = 'UPDATE' and (
    new.institution_id <> old.institution_id
    or new.communication_id <> old.communication_id
    or new.group_ref <> old.group_ref
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at
  ) then
    raise exception 'Communication audience scope is immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.communication_guard_delivery_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.communication_id <> old.communication_id
    or new.version_id <> old.version_id
    or new.version <> old.version
    or new.contact_ref <> old.contact_ref
    or new.channel <> old.channel
    or new.idempotency_key_hash <> old.idempotency_key_hash
    or new.created_at <> old.created_at then
    raise exception 'Communication delivery identity is immutable';
  end if;
  return new;
end;
$$;

create or replace function public.communication_guard_job_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id <> old.institution_id
    or new.communication_id <> old.communication_id
    or new.version_id is distinct from old.version_id
    or new.version is distinct from old.version
    or new.delivery_id is distinct from old.delivery_id
    or new.job_type <> old.job_type
    or new.idempotency_key_hash <> old.idempotency_key_hash
    or new.created_at <> old.created_at then
    raise exception 'Communication job identity is immutable';
  end if;
  return new;
end;
$$;

create trigger communication_audiences_guard_scope_trigger
before insert or update or delete on public.communication_audiences
for each row execute function public.communication_guard_audience_scope();

create trigger communication_deliveries_guard_identity_trigger
before update on public.communication_deliveries
for each row execute function public.communication_guard_delivery_identity();

create trigger communication_jobs_guard_identity_trigger
before update on public.communication_jobs
for each row execute function public.communication_guard_job_identity();

revoke all on function public.communication_guard_audience_scope() from public, anon, authenticated;
revoke all on function public.communication_guard_delivery_identity() from public, anon, authenticated;
revoke all on function public.communication_guard_job_identity() from public, anon, authenticated;

commit;
