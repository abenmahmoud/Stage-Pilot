begin;

revoke all on table
  public.agent_actions,
  public.agent_approvals,
  public.agent_action_audit
from service_role;

grant select, insert, update on table
  public.agent_actions,
  public.agent_approvals
to service_role;

grant select, insert on table public.agent_action_audit to service_role;

commit;
