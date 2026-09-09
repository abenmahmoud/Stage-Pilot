create table public.support_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  session_id uuid references public.support_device_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  endpoint_hash text not null unique,
  subscription jsonb not null,
  last_event_id bigint not null default 0,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  check (num_nonnulls(session_id, user_id) = 1)
);
create index support_push_subscriptions_active_idx on public.support_push_subscriptions (institution_id, expires_at) where disabled_at is null;
create table public.support_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.support_push_subscriptions(id) on delete cascade,
  event_id bigint not null,
  status text not null check (status in ('reserved', 'sent', 'uncertain', 'rejected')),
  created_at timestamptz not null default now(),
  unique (subscription_id, event_id)
);
alter table public.support_push_subscriptions enable row level security;
alter table public.support_push_deliveries enable row level security;
revoke all on public.support_push_subscriptions, public.support_push_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.support_push_subscriptions, public.support_push_deliveries to service_role;
