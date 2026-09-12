-- Additive: existing support subscriptions and receipts remain valid.
alter table public.support_push_subscriptions
  add column identity_session_id uuid references public.identity_device_sessions(id) on delete cascade,
  add column flash_since timestamptz,
  drop constraint support_push_subscriptions_check,
  add constraint support_push_owner_check check (
    (user_id is not null and session_id is null and identity_session_id is null)
    or (user_id is null and num_nonnulls(session_id, identity_session_id) >= 1)
  );

alter table public.flash_infos add column published_version integer;
update public.flash_infos f set published_version = (
  select max(v.version) from public.flash_info_versions v
  where v.flash_info_id=f.id and v.institution_id=f.institution_id and v.status='publiee'
);
alter table public.flash_infos add constraint flash_published_version_fk
  foreign key (id, published_version) references public.flash_info_versions(flash_info_id, version);
alter table public.flash_info_versions add column push_authorized_at timestamptz;

alter table public.support_push_deliveries
  alter column event_id drop not null,
  add column flash_version_id uuid references public.flash_info_versions(id) on delete restrict,
  add column kind text not null default 'support' check (kind in ('support','flash','flash_removed')),
  add constraint support_push_source_check check (
    (kind='support' and event_id is not null and flash_version_id is null)
    or (kind in ('flash','flash_removed') and event_id is null and flash_version_id is not null)
  );
create unique index support_push_flash_once_idx on public.support_push_deliveries(subscription_id,flash_version_id)
  where flash_version_id is not null;
create index support_push_flash_scan_idx on public.flash_info_versions(institution_id,push_authorized_at)
  where push_authorized_at is not null;
-- These tables remain server-only with their existing RLS and revoked grants.

grant update (status,sent_at) on public.flash_notification_dispatches to service_role;
