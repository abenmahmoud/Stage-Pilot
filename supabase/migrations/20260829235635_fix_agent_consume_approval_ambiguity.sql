begin;

create or replace function public.agent_consume_approval(
  requested_action_id uuid,
  requested_approval_id uuid,
  executing_user_id uuid,
  expected_tool_key text,
  expected_input_fingerprint text
)
returns table (
  action_id uuid,
  approval_id uuid,
  consumed_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked_action public.agent_actions%rowtype;
  locked_approval public.agent_approvals%rowtype;
  consumed_timestamp timestamptz := transaction_timestamp();
begin
  if executing_user_id is null
    or expected_tool_key is null
    or expected_input_fingerprint is null
  then
    raise exception 'Approval consumption binding is incomplete';
  end if;

  select action_record.* into locked_action
  from public.agent_actions as action_record
  where action_record.id = requested_action_id
  for update;

  if not found
    or locked_action.authority_level <> 'A3'
    or locked_action.status <> 'awaiting_approval'
    or locked_action.requested_by_user_id <> executing_user_id
    or locked_action.tool_key <> expected_tool_key
    or locked_action.input_fingerprint <> expected_input_fingerprint
  then
    raise exception 'Agent action is not eligible for approval consumption';
  end if;

  select approval_record.* into locked_approval
  from public.agent_approvals as approval_record
  where approval_record.id = requested_approval_id
    and approval_record.action_id = requested_action_id
  for update;

  if not found
    or locked_approval.institution_id <> locked_action.institution_id
    or locked_approval.tool_key <> locked_action.tool_key
    or locked_approval.input_fingerprint <> locked_action.input_fingerprint
    or locked_approval.requested_by_user_id <> executing_user_id
    or locked_approval.status <> 'approved'
    or locked_approval.decision_by_user_id is null
    or locked_approval.decision_by_user_id = executing_user_id
    or locked_approval.decision_role <> locked_approval.requested_from_role
    or locked_approval.decided_at is null
    or locked_approval.decided_at > consumed_timestamp
    or locked_approval.expires_at <= consumed_timestamp
    or locked_approval.consumed_at is not null
  then
    raise exception 'Agent approval is not eligible for consumption';
  end if;

  update public.agent_approvals as approval_record
  set consumed_at = consumed_timestamp,
      updated_at = consumed_timestamp
  where approval_record.id = locked_approval.id;

  update public.agent_actions as action_record
  set status = 'running',
      started_at = consumed_timestamp,
      updated_at = consumed_timestamp
  where action_record.id = locked_action.id;

  return query
  select locked_action.id, locked_approval.id, consumed_timestamp;
end;
$$;

revoke all on function public.agent_consume_approval(uuid, uuid, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.agent_consume_approval(uuid, uuid, uuid, text, text)
to service_role;

commit;
