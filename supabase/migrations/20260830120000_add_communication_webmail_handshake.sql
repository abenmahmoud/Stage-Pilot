begin;

alter table public.communication_deliveries
  add column resolution_hash text,
  add column command_hash text,
  add column webmail_receipt_hash text;

alter table public.communication_deliveries
  add constraint communication_deliveries_resolution_hash_check check (
    resolution_hash is null or resolution_hash ~ '^[a-f0-9]{64}$'
  ),
  add constraint communication_deliveries_command_hash_check check (
    command_hash is null or command_hash ~ '^[a-f0-9]{64}$'
  ),
  add constraint communication_deliveries_webmail_receipt_hash_check check (
    webmail_receipt_hash is null or webmail_receipt_hash ~ '^[a-f0-9]{64}$'
  ),
  add constraint communication_deliveries_command_ready_check check (
    status not in ('queued', 'sent', 'delivered', 'deferred', 'rejected', 'spam', 'unsubscribed')
    or (resolution_hash is not null and command_hash is not null)
  ),
  add constraint communication_deliveries_send_receipt_check check (
    status not in ('sent', 'delivered', 'deferred', 'rejected', 'spam', 'unsubscribed')
    or (provider_message_ref is not null and webmail_receipt_hash is not null and sent_at is not null)
  );

create unique index communication_deliveries_scope_command_uidx
  on public.communication_deliveries (institution_id, command_hash)
  where command_hash is not null;

create unique index communication_deliveries_scope_webmail_receipt_uidx
  on public.communication_deliveries (institution_id, webmail_receipt_hash)
  where webmail_receipt_hash is not null;

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
    or new.created_at <> old.created_at
    or (old.resolution_hash is not null and new.resolution_hash is distinct from old.resolution_hash)
    or (old.command_hash is not null and new.command_hash is distinct from old.command_hash)
    or (old.webmail_receipt_hash is not null and new.webmail_receipt_hash is distinct from old.webmail_receipt_hash)
  then
    raise exception 'Communication delivery identity is immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.communication_guard_delivery_identity() from public, anon, authenticated;

comment on column public.communication_deliveries.resolution_hash is
  'HMAC of the approved recipient resolution snapshot; contains no contact locator.';
comment on column public.communication_deliveries.command_hash is
  'SHA-256 of the exact signed Webmail command; immutable after first assignment.';
comment on column public.communication_deliveries.webmail_receipt_hash is
  'SHA-256 of the verified Webmail receipt; immutable after first assignment.';

commit;
