begin;

alter table public.support_job_runs
  add column if not exists institution_id uuid;
alter table public.support_failed_jobs
  add column if not exists institution_id uuid;
alter table public.support_delivery_events
  add column if not exists institution_id uuid;
alter table public.support_webhook_receipts
  add column if not exists institution_id uuid;

update public.support_job_runs as run
set institution_id = request.institution_id
from public.support_requests as request
where run.request_id = request.id
  and run.institution_id is null;

update public.support_failed_jobs as failed
set institution_id = request.institution_id
from public.support_requests as request
where failed.request_id = request.id
  and failed.institution_id is null;

update public.support_delivery_events as delivery
set institution_id = request.institution_id
from public.support_messages as message
join public.support_requests as request on request.id = message.request_id
where delivery.message_id = message.id
  and delivery.institution_id is null;

do $$
declare
  eligible_count integer;
  eligible_institution_id uuid;
begin
  if exists (
    select 1 from public.support_webhook_receipts where institution_id is null
  ) then
    select count(*)::integer, min(id::text)::uuid
      into eligible_count, eligible_institution_id
    from public.institutions
    where status in ('pilot', 'active');

    if eligible_count <> 1 then
      raise exception
        'support webhook receipt backfill requires exactly one pilot or active institution, found %',
        eligible_count;
    end if;

    update public.support_webhook_receipts
    set institution_id = eligible_institution_id
    where institution_id is null;
  end if;
end
$$;

do $$
begin
  if exists (select 1 from public.support_job_runs where institution_id is null or request_id is null) then
    raise exception 'support job runs require a request and institution';
  end if;
  if exists (select 1 from public.support_failed_jobs where institution_id is null or request_id is null) then
    raise exception 'support failed jobs require a request and institution';
  end if;
  if exists (select 1 from public.support_delivery_events where institution_id is null) then
    raise exception 'support delivery events require an institution';
  end if;
  if exists (select 1 from public.support_webhook_receipts where institution_id is null) then
    raise exception 'support webhook receipts require an institution';
  end if;
end
$$;

alter table public.support_job_runs
  alter column institution_id set not null,
  alter column request_id set not null;
alter table public.support_failed_jobs
  alter column institution_id set not null,
  alter column request_id set not null;
alter table public.support_delivery_events
  alter column institution_id set not null;
alter table public.support_webhook_receipts
  alter column institution_id set not null;

do $$
declare
  table_name text;
  constraint_name text;
begin
  foreach table_name in array array[
    'support_job_runs',
    'support_failed_jobs',
    'support_delivery_events',
    'support_webhook_receipts'
  ] loop
    constraint_name := table_name || '_institution_id_fkey';
    if not exists (
      select 1 from pg_constraint
      where conname = constraint_name
        and conrelid = format('public.%I', table_name)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (institution_id) references public.institutions(id) on delete restrict',
        table_name,
        constraint_name
      );
    end if;
  end loop;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_requests_id_institution_key'
      and conrelid = 'public.support_requests'::regclass
  ) then
    alter table public.support_requests
      add constraint support_requests_id_institution_key
      unique (id, institution_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'support_job_runs_request_institution_fkey'
      and conrelid = 'public.support_job_runs'::regclass
  ) then
    alter table public.support_job_runs
      add constraint support_job_runs_request_institution_fkey
      foreign key (request_id, institution_id)
      references public.support_requests(id, institution_id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'support_failed_jobs_request_institution_fkey'
      and conrelid = 'public.support_failed_jobs'::regclass
  ) then
    alter table public.support_failed_jobs
      add constraint support_failed_jobs_request_institution_fkey
      foreign key (request_id, institution_id)
      references public.support_requests(id, institution_id)
      on delete cascade;
  end if;
end
$$;

alter table public.support_job_runs
  drop constraint if exists support_job_runs_job_id_attempt_key;
alter table public.support_failed_jobs
  drop constraint if exists support_failed_jobs_job_id_key;
alter table public.support_delivery_events
  drop constraint if exists support_delivery_events_provider_provider_event_id_event_ty_key;
alter table public.support_webhook_receipts
  drop constraint if exists support_webhook_receipts_provider_external_id_payload_hash_key;

create unique index if not exists support_job_runs_institution_job_attempt_uidx
  on public.support_job_runs (institution_id, job_id, attempt);
create unique index if not exists support_failed_jobs_institution_job_uidx
  on public.support_failed_jobs (institution_id, job_id);
create unique index if not exists support_delivery_events_institution_provider_uidx
  on public.support_delivery_events (
    institution_id,
    provider,
    provider_event_id,
    event_type
  );
create unique index if not exists support_webhook_receipts_institution_provider_uidx
  on public.support_webhook_receipts (
    institution_id,
    provider,
    external_id,
    payload_hash
  );

create index if not exists support_job_runs_institution_created_idx
  on public.support_job_runs (institution_id, created_at);
create index if not exists support_failed_jobs_institution_pending_idx
  on public.support_failed_jobs (institution_id, failed_at)
  where retried_at is null;
create index if not exists support_delivery_events_institution_created_idx
  on public.support_delivery_events (institution_id, created_at);
create index if not exists support_webhook_receipts_institution_created_idx
  on public.support_webhook_receipts (institution_id, created_at);

create or replace function public.support_prevent_technical_institution_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id is distinct from old.institution_id then
    raise exception 'support technical institution is immutable';
  end if;
  return new;
end
$$;

create or replace function public.support_assert_delivery_event_institution()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.support_messages as message
    join public.support_requests as request on request.id = message.request_id
    where message.id = new.message_id
      and request.institution_id = new.institution_id
  ) then
    raise exception 'support delivery event institution mismatch';
  end if;
  return new;
end
$$;

drop trigger if exists support_job_runs_institution_immutable
  on public.support_job_runs;
create trigger support_job_runs_institution_immutable
before update of institution_id on public.support_job_runs
for each row execute function public.support_prevent_technical_institution_change();

drop trigger if exists support_failed_jobs_institution_immutable
  on public.support_failed_jobs;
create trigger support_failed_jobs_institution_immutable
before update of institution_id on public.support_failed_jobs
for each row execute function public.support_prevent_technical_institution_change();

drop trigger if exists support_delivery_events_institution_immutable
  on public.support_delivery_events;
create trigger support_delivery_events_institution_immutable
before update of institution_id on public.support_delivery_events
for each row execute function public.support_prevent_technical_institution_change();

drop trigger if exists support_webhook_receipts_institution_immutable
  on public.support_webhook_receipts;
create trigger support_webhook_receipts_institution_immutable
before update of institution_id on public.support_webhook_receipts
for each row execute function public.support_prevent_technical_institution_change();

drop trigger if exists support_delivery_events_institution_consistent
  on public.support_delivery_events;
create trigger support_delivery_events_institution_consistent
before insert or update of message_id, institution_id on public.support_delivery_events
for each row execute function public.support_assert_delivery_event_institution();

alter table public.support_job_runs enable row level security;
alter table public.support_job_runs force row level security;
alter table public.support_failed_jobs enable row level security;
alter table public.support_failed_jobs force row level security;
alter table public.support_delivery_events enable row level security;
alter table public.support_delivery_events force row level security;
alter table public.support_webhook_receipts enable row level security;
alter table public.support_webhook_receipts force row level security;

revoke all on table public.support_job_runs from public, anon, authenticated;
revoke all on table public.support_failed_jobs from public, anon, authenticated;
revoke all on table public.support_delivery_events from public, anon, authenticated;
revoke all on table public.support_webhook_receipts from public, anon, authenticated;
revoke execute on function public.support_prevent_technical_institution_change()
  from public, anon, authenticated;
revoke execute on function public.support_assert_delivery_event_institution()
  from public, anon, authenticated;

commit;
