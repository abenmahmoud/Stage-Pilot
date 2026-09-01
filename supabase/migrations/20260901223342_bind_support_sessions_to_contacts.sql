set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.support_device_sessions
  add column access_contact_id uuid;

-- Legacy sessions cannot be attributed to a contact reliably. Force a fresh
-- proof instead of guessing their origin.
update public.support_device_sessions
set revoked_at = clock_timestamp()
where revoked_at is null;

alter table public.support_device_sessions
  add constraint support_device_sessions_access_contact_id_fkey
  foreign key (access_contact_id)
  references public.support_contacts(id)
  on delete set null
  not valid;

alter table public.support_device_sessions
  validate constraint support_device_sessions_access_contact_id_fkey;

create index support_device_sessions_access_contact_idx
  on public.support_device_sessions (access_contact_id)
  where access_contact_id is not null;

create or replace function public.support_revoke_contact_access()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected_contact_id uuid;
begin
  affected_contact_id := old.id;

  if tg_op = 'DELETE'
     or (old.disabled_at is null and new.disabled_at is not null) then
    update public.support_device_sessions
    set revoked_at = clock_timestamp()
    where access_contact_id = affected_contact_id
      and revoked_at is null;

    update public.support_magic_tokens
    set used_at = clock_timestamp()
    where contact_id = affected_contact_id
      and used_at is null;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.support_revoke_contact_access() from public, anon, authenticated;

create trigger support_contacts_revoke_access_on_disable
after update of disabled_at on public.support_contacts
for each row
execute function public.support_revoke_contact_access();

create trigger support_contacts_revoke_access_before_delete
before delete on public.support_contacts
for each row
execute function public.support_revoke_contact_access();
