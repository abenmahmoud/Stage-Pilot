begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.support_rate_limits
  drop constraint if exists support_rate_limits_scope_check,
  drop constraint if exists support_rate_limits_key_hash_check;

alter table public.support_rate_limits
  add constraint support_rate_limits_scope_check check (
    scope in (
      'assistant_session',
      'assistant_network',
      'request_network',
      'message_session',
      'magic_token_network',
      'content_ai_user',
      'agent_translation_user',
      'request_device_burst',
      'request_device_daily',
      'request_contact_burst',
      'request_contact_daily',
      'request_behavior_repeat',
      'request_invalid_device',
      'attachment_reserve_session',
      'attachment_confirm_session',
      'agent_write_user'
    )
  ),
  add constraint support_rate_limits_key_hash_check check (
    key_hash ~ '^[a-f0-9]{64}$'
  );

alter table public.support_rate_limits enable row level security;
alter table public.support_rate_limits force row level security;
revoke all on table public.support_rate_limits from anon, authenticated;

comment on table public.support_rate_limits is
  'Atomic server-only limits using pseudonymous HMAC keys; never stores clear contacts, device IDs, account IDs, or IP addresses.';

commit;
