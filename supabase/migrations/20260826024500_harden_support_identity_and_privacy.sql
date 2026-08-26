begin;

-- A tracking link proves control of one address only. The composite foreign key
-- also prevents a token from targeting a contact from another request.
alter table public.support_magic_tokens
  add column contact_id uuid;

with single_email_contact as (
  select
    token.id as token_id,
    min(contact.id::text)::uuid as contact_id
  from public.support_magic_tokens token
  join public.support_contacts contact
    on contact.request_id = token.request_id
   and contact.channel = 'email'
   and contact.disabled_at is null
  group by token.id
  having count(*) = 1
)
update public.support_magic_tokens token
set contact_id = candidate.contact_id
from single_email_contact candidate
where token.id = candidate.token_id;

alter table public.support_magic_tokens
  add constraint support_magic_tokens_contact_request_fkey
  foreign key (contact_id, request_id)
  references public.support_contacts (id, request_id)
  on delete cascade;

create index support_magic_tokens_contact_request_idx
  on public.support_magic_tokens (contact_id, request_id);

-- The distributed limiter already retains a short-lived pseudonymous network
-- key. Requests no longer need a second copy kept for the dossier lifetime.
update public.support_requests
set source_ip_hash = null
where source_ip_hash is not null;

alter table public.support_rate_limits
  drop constraint support_rate_limits_scope_check;

alter table public.support_rate_limits
  add constraint support_rate_limits_scope_check check (
    scope in (
      'assistant_session',
      'assistant_network',
      'request_network',
      'message_session',
      'magic_token_network'
    )
  );

commit;
