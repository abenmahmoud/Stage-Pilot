begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.support_rate_limits drop constraint support_rate_limits_scope_check;
alter table public.support_rate_limits add constraint support_rate_limits_scope_check check (
  scope in (
    'assistant_session', 'assistant_network', 'assistant_global', 'request_network',
    'message_session', 'magic_token_network', 'content_ai_user', 'agent_translation_user',
    'request_device_burst', 'request_device_daily', 'request_contact_burst',
    'request_contact_daily', 'request_behavior_repeat', 'request_invalid_device',
    'attachment_reserve_session', 'attachment_confirm_session', 'attachment_download_session',
    'agent_attachment_download_user', 'agent_write_user'
  )
);

commit;
