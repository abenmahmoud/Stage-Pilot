set lock_timeout = '5s';
set statement_timeout = '30s';

create table public.agent_ai_budget_days (
  budget_key text not null,
  budget_day date not null,
  limit_micros bigint not null,
  reserved_micros bigint not null,
  reservation_count integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (budget_key, budget_day),
  constraint agent_ai_budget_days_key_check
    check (budget_key = 'openai'),
  constraint agent_ai_budget_days_limit_check
    check (limit_micros > 0 and limit_micros <= 1000000000000),
  constraint agent_ai_budget_days_reserved_check
    check (reserved_micros >= 0 and reserved_micros <= limit_micros),
  constraint agent_ai_budget_days_count_check
    check (reservation_count >= 0)
);

alter table public.agent_ai_budget_days enable row level security;
alter table public.agent_ai_budget_days force row level security;

revoke all on table public.agent_ai_budget_days from public, anon, authenticated;
revoke all on table public.agent_ai_budget_days from service_role;
grant select, insert, update on table public.agent_ai_budget_days to service_role;
