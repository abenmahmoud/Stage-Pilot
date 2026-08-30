do $$
begin
  if exists (
    select 1
    from public.communication_deliveries
    where provider_message_ref is not null
      and provider_message_ref !~ '^[a-f0-9]{64}$'
  ) then
    raise exception 'Communication provider message refs must be HMAC-SHA-256 values';
  end if;

  if exists (
    select 1
    from public.communication_deliveries
    where provider_message_ref is not null
    group by institution_id, provider_message_ref
    having count(*) > 1
  ) then
    raise exception 'Communication provider message refs must be unique per institution';
  end if;
end;
$$;

drop index if exists public.communication_deliveries_provider_message_idx;

alter table public.communication_deliveries
  add constraint communication_deliveries_provider_message_ref_hmac_check
  check (
    provider_message_ref is null
    or provider_message_ref ~ '^[a-f0-9]{64}$'
  ) not valid;

alter table public.communication_deliveries
  validate constraint communication_deliveries_provider_message_ref_hmac_check;

create unique index communication_deliveries_institution_provider_message_uidx
  on public.communication_deliveries (institution_id, provider_message_ref)
  where provider_message_ref is not null;
