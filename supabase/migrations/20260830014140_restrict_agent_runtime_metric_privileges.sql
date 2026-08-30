revoke all on table public.agent_runtime_metrics from service_role;
revoke all on function public.block_agent_runtime_metric_mutation() from service_role;

grant select, insert on table public.agent_runtime_metrics to service_role;
