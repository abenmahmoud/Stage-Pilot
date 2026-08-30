alter table public.communication_deliveries
  drop constraint if exists communication_deliveries_status_check;

alter table public.communication_deliveries
  add constraint communication_deliveries_status_check check (
    status in (
      'prepared', 'queued', 'sent', 'delivered', 'deferred',
      'rejected', 'spam', 'unsubscribed', 'error', 'cancelled'
    )
  );

alter table public.communication_events
  add column external_event_hash text;

alter table public.communication_events
  add constraint communication_events_external_event_hash_check check (
    external_event_hash is null or external_event_hash ~ '^[a-f0-9]{64}$'
  );

create unique index communication_events_scope_external_event_uidx
  on public.communication_events (institution_id, external_event_hash)
  where external_event_hash is not null;

comment on column public.communication_events.external_event_hash is
  'HMAC technique used to deduplicate provider events without storing provider identifiers.';
