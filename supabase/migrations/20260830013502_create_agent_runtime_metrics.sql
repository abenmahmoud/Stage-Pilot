create table public.agent_runtime_metrics (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  operation text not null,
  outcome text not null,
  model text,
  ai_attempted boolean not null default false,
  used_ai boolean not null default false,
  latency_ms integer not null,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_micros bigint,
  pricing_configured boolean not null default false,
  source_count integer not null default 0,
  turn_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint agent_runtime_metrics_operation_check
    check (operation = 'support_assistant'),
  constraint agent_runtime_metrics_outcome_check
    check (outcome in (
      'deterministic',
      'pretriage',
      'model_unavailable',
      'provider_error',
      'invalid_output',
      'policy_fallback',
      'low_confidence',
      'category_conflict',
      'model_success',
      'timeout'
    )),
  constraint agent_runtime_metrics_model_check
    check (model is null or char_length(model) between 1 and 80),
  constraint agent_runtime_metrics_latency_check
    check (latency_ms between 0 and 120000),
  constraint agent_runtime_metrics_input_tokens_check
    check (input_tokens is null or input_tokens between 0 and 10000000),
  constraint agent_runtime_metrics_output_tokens_check
    check (output_tokens is null or output_tokens between 0 and 10000000),
  constraint agent_runtime_metrics_total_tokens_check
    check (total_tokens is null or total_tokens between 0 and 20000000),
  constraint agent_runtime_metrics_estimated_cost_check
    check (estimated_cost_micros is null or estimated_cost_micros between 0 and 1000000000000),
  constraint agent_runtime_metrics_source_count_check
    check (source_count between 0 and 20),
  constraint agent_runtime_metrics_turn_count_check
    check (turn_count between 0 and 21),
  constraint agent_runtime_metrics_ai_consistency_check
    check (not used_ai or ai_attempted),
  constraint agent_runtime_metrics_pricing_consistency_check
    check (estimated_cost_micros is null or pricing_configured)
);

create index agent_runtime_metrics_institution_created_idx
  on public.agent_runtime_metrics (institution_id, created_at);

create index agent_runtime_metrics_institution_outcome_created_idx
  on public.agent_runtime_metrics (institution_id, outcome, created_at);

create or replace function public.block_agent_runtime_metric_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'agent runtime metrics are append-only';
end;
$$;

create trigger block_agent_runtime_metric_mutation
before update or delete on public.agent_runtime_metrics
for each row execute function public.block_agent_runtime_metric_mutation();

alter table public.agent_runtime_metrics enable row level security;
alter table public.agent_runtime_metrics force row level security;

revoke all on table public.agent_runtime_metrics from public, anon, authenticated;
revoke all on function public.block_agent_runtime_metric_mutation() from public, anon, authenticated;
grant select, insert on table public.agent_runtime_metrics to service_role;
