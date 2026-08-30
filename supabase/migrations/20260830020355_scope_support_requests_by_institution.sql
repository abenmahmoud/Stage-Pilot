begin;

alter table public.support_requests
  add column if not exists institution_id uuid;

do $$
declare
  eligible_count integer;
  eligible_institution_id uuid;
begin
  if exists (
    select 1 from public.support_requests where institution_id is null
  ) then
    select count(*)::integer, min(id::text)::uuid
      into eligible_count, eligible_institution_id
    from public.institutions
    where status in ('pilot', 'active');

    if eligible_count <> 1 then
      raise exception
        'support_requests backfill requires exactly one pilot or active institution, found %',
        eligible_count;
    end if;

    update public.support_requests
    set institution_id = eligible_institution_id
    where institution_id is null;
  end if;
end
$$;

alter table public.support_requests
  alter column institution_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_requests_institution_id_fkey'
      and conrelid = 'public.support_requests'::regclass
  ) then
    alter table public.support_requests
      add constraint support_requests_institution_id_fkey
      foreign key (institution_id)
      references public.institutions(id)
      on delete restrict;
  end if;
end
$$;

alter table public.support_requests
  drop constraint if exists support_requests_idempotency_key_hash_key;

drop index if exists public.support_requests_idempotency_key_hash_key;

create unique index if not exists support_requests_institution_idempotency_uidx
  on public.support_requests (institution_id, idempotency_key_hash);

create index if not exists support_requests_institution_queue_idx
  on public.support_requests (institution_id, status, created_at);

alter table public.support_messages
  drop constraint if exists support_messages_client_idempotency_key_hash_key;

drop index if exists public.support_messages_client_idempotency_key_hash_key;

create unique index if not exists support_messages_request_idempotency_uidx
  on public.support_messages (request_id, client_idempotency_key_hash);

create or replace function public.support_prevent_request_institution_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.institution_id is distinct from old.institution_id then
    raise exception 'support request institution is immutable';
  end if;
  return new;
end
$$;

drop trigger if exists support_requests_institution_immutable
  on public.support_requests;
create trigger support_requests_institution_immutable
before update of institution_id on public.support_requests
for each row execute function public.support_prevent_request_institution_change();

alter table public.support_requests enable row level security;
alter table public.support_requests force row level security;

revoke all on table public.support_requests from public, anon, authenticated;
revoke execute on function public.support_prevent_request_institution_change()
  from public, anon, authenticated;

commit;
