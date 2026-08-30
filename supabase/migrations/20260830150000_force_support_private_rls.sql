begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'support_requests',
    'support_contacts',
    'support_messages',
    'support_device_sessions',
    'support_session_requests',
    'support_magic_tokens',
    'support_attachments',
    'support_events',
    'support_job_runs',
    'support_failed_jobs',
    'support_delivery_events',
    'support_webhook_receipts',
    'support_callback_tasks',
    'support_templates',
    'support_rate_limits',
    'support_assistant_routing_reviews'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Missing private support table: %', table_name;
    end if;

    execute format(
      'alter table public.%I enable row level security',
      table_name
    );
    execute format(
      'alter table public.%I force row level security',
      table_name
    );
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      table_name
    );
  end loop;
end;
$$;

commit;
