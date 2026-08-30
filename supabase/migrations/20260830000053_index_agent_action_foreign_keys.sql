begin;

drop index if exists public.agent_action_audit_action_created_idx;
create index agent_action_audit_action_created_idx
  on public.agent_action_audit (action_id, institution_id, created_at desc);

drop index if exists public.agent_approvals_action_institution_fk_idx;
create index agent_approvals_action_binding_fk_idx
  on public.agent_approvals (
    action_id,
    institution_id,
    tool_key,
    input_fingerprint,
    requested_by_user_id
  );

create index agent_actions_requested_by_user_fk_idx
  on public.agent_actions (requested_by_user_id)
  where requested_by_user_id is not null;

create index agent_approvals_requested_by_user_fk_idx
  on public.agent_approvals (requested_by_user_id);

create index agent_approvals_decision_by_user_fk_idx
  on public.agent_approvals (decision_by_user_id)
  where decision_by_user_id is not null;

create index agent_action_audit_actor_user_fk_idx
  on public.agent_action_audit (actor_user_id)
  where actor_user_id is not null;

commit;
