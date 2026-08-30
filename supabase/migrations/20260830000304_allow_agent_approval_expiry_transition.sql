begin;

create or replace function public.agent_validate_approval_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  action_authority text;
  action_status text;
begin
  if tg_op = 'DELETE' then
    raise exception 'Agent approvals are append-only records';
  end if;

  select authority_level, status
  into action_authority, action_status
  from public.agent_actions
  where id = new.action_id
    and institution_id = new.institution_id;

  if action_authority is distinct from 'A3' then
    raise exception 'Only A3 actions can receive approvals';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'pending' or action_status <> 'awaiting_approval' then
      raise exception 'Invalid initial approval state';
    end if;
    return new;
  end if;

  if old.institution_id <> new.institution_id
    or old.action_id <> new.action_id
    or old.tool_key <> new.tool_key
    or old.input_fingerprint <> new.input_fingerprint
    or old.requested_by_user_id <> new.requested_by_user_id
    or old.requested_from_role <> new.requested_from_role
    or old.requested_at <> new.requested_at
    or old.expires_at <> new.expires_at
  then
    raise exception 'Agent approval binding fields are immutable';
  end if;

  if old.status <> new.status and not (
    (old.status = 'pending'
      and new.status in ('approved', 'rejected', 'expired', 'cancelled'))
    or (old.status = 'approved'
      and old.consumed_at is null
      and new.status in ('expired', 'cancelled'))
  ) then
    raise exception 'Invalid agent approval status transition';
  end if;

  if new.status = 'approved' and (
    new.decided_at > transaction_timestamp()
    or new.expires_at <= transaction_timestamp()
  ) then
    raise exception 'Approval decision time is invalid';
  end if;

  if new.status = 'expired' and new.expires_at > transaction_timestamp() then
    raise exception 'Approval cannot expire before expires_at';
  end if;

  if old.consumed_at is not null and new.consumed_at is distinct from old.consumed_at then
    raise exception 'Consumed approval is immutable';
  end if;

  return new;
end;
$$;

revoke all on function public.agent_validate_approval_transition()
from public, anon, authenticated;
grant execute on function public.agent_validate_approval_transition()
to service_role;

commit;
