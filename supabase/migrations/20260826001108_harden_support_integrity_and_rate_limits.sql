begin;

-- Refuse relationships that could silently attach data to the wrong dossier.
alter table public.support_contacts
  alter column request_id set not null;

alter table public.support_delivery_events
  alter column message_id set not null;

alter table public.support_messages
  add constraint support_messages_id_request_key unique (id, request_id);

alter table public.support_contacts
  add constraint support_contacts_id_request_key unique (id, request_id);

alter table public.support_attachments
  add constraint support_attachments_message_request_fkey
  foreign key (message_id, request_id)
  references public.support_messages (id, request_id)
  on delete cascade;

alter table public.support_callback_tasks
  add constraint support_callbacks_contact_request_fkey
  foreign key (phone_contact_id, request_id)
  references public.support_contacts (id, request_id)
  on delete cascade;

create unique index support_contacts_one_active_primary_idx
  on public.support_contacts (request_id)
  where is_primary and disabled_at is null;

create unique index support_contacts_unique_active_value_idx
  on public.support_contacts (request_id, channel, normalized_hash)
  where disabled_at is null;

-- One row per pseudonymous caller and scope makes throttling atomic across all
-- Vercel instances. No IP address or browser token is stored in clear text.
create table public.support_rate_limits (
  scope text not null check (
    scope in ('assistant_session', 'assistant_network', 'request_network', 'message_session')
  ),
  key_hash text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  primary key (scope, key_hash)
);

create index support_rate_limits_expiry_idx
  on public.support_rate_limits (expires_at);

alter table public.support_rate_limits enable row level security;
revoke all on table public.support_rate_limits from anon, authenticated;

commit;
