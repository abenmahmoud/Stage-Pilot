set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.agent_runtime_metrics drop constraint agent_runtime_metrics_operation_check;
alter table public.agent_runtime_metrics add constraint agent_runtime_metrics_operation_check
  check (operation in ('support_assistant', 'content_assist', 'communication_assist', 'support_translation'));

create table public.agent_ai_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  budget_key text not null,
  budget_day date not null,
  operation text not null check (operation in ('support_assistant', 'content_assist', 'communication_assist', 'support_translation')),
  reserved_micros bigint not null check (reserved_micros > 0 and reserved_micros <= 1000000000000),
  settled_micros bigint check (settled_micros >= 0 and settled_micros <= 1000000000000),
  created_at timestamptz not null default clock_timestamp(),
  settled_at timestamptz,
  foreign key (budget_key, budget_day) references public.agent_ai_budget_days (budget_key, budget_day),
  check ((settled_micros is null) = (settled_at is null))
);
create index agent_ai_budget_reservations_day_idx on public.agent_ai_budget_reservations (budget_key, budget_day);
alter table public.agent_ai_budget_reservations enable row level security;
alter table public.agent_ai_budget_reservations force row level security;
revoke all on table public.agent_ai_budget_reservations from public, anon, authenticated, service_role;
grant select, insert, update on table public.agent_ai_budget_reservations to service_role;
