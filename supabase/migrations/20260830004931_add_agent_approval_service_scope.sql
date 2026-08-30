begin;

alter table public.agent_actions
add column service_code text;

do $$
begin
  if exists (
    select 1
    from public.agent_actions
    where service_code is null
  ) then
    raise exception 'Existing agent actions require an explicit service backfill';
  end if;
end;
$$;

alter table public.agent_actions
alter column service_code set not null;

alter table public.agent_actions
add constraint agent_actions_service_code_check check (
  service_code in (
    'referent_numerique',
    'ddfpt',
    'secretariat',
    'vie_scolaire',
    'intendance',
    'direction',
    'administration'
  )
);

create index agent_actions_institution_service_status_created_idx
on public.agent_actions (
  institution_id,
  service_code,
  status,
  requested_at desc
);

create or replace function public.agent_validate_action_service_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.service_code <> new.service_code then
    raise exception 'Agent action service scope is immutable';
  end if;
  return new;
end;
$$;

create trigger agent_actions_validate_service_scope
before update of service_code on public.agent_actions
for each row execute function public.agent_validate_action_service_scope();

create or replace function public.agent_decide_approval(
  requested_approval_id uuid,
  requested_institution_id uuid,
  deciding_user_id uuid,
  expected_decision_role text,
  allowed_service_codes text[],
  allow_all_services boolean,
  requested_decision text,
  requested_reason text
)
returns table (
  result_approval_id uuid,
  result_action_id uuid,
  result_status text,
  result_decided_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_action_id uuid;
  locked_action public.agent_actions%rowtype;
  locked_approval public.agent_approvals%rowtype;
  decision_timestamp timestamptz := transaction_timestamp();
  clean_reason text := nullif(btrim(requested_reason), '');
begin
  if requested_approval_id is null
    or requested_institution_id is null
    or deciding_user_id is null
    or expected_decision_role not in ('staff', 'service_manager', 'direction', 'superadmin')
    or requested_decision not in ('approved', 'rejected')
  then
    raise exception 'Approval decision binding is incomplete';
  end if;

  if requested_decision = 'rejected'
    and (clean_reason is null or length(clean_reason) not between 2 and 500)
  then
    raise exception 'A rejection reason between 2 and 500 characters is required';
  end if;

  if requested_decision = 'approved'
    and clean_reason is not null
    and length(clean_reason) not between 2 and 500
  then
    raise exception 'An approval reason must contain between 2 and 500 characters';
  end if;

  select approval_record.action_id into target_action_id
  from public.agent_approvals as approval_record
  where approval_record.id = requested_approval_id
    and approval_record.institution_id = requested_institution_id;

  if not found then
    raise exception 'Agent approval is not available';
  end if;

  select action_record.* into locked_action
  from public.agent_actions as action_record
  where action_record.id = target_action_id
    and action_record.institution_id = requested_institution_id
  for update;

  if not found
    or locked_action.authority_level <> 'A3'
    or locked_action.status <> 'awaiting_approval'
    or (
      not coalesce(allow_all_services, false)
      and not (
        locked_action.service_code = any(
          coalesce(allowed_service_codes, array[]::text[])
        )
      )
    )
  then
    raise exception 'Agent action is outside the decision scope';
  end if;

  select approval_record.* into locked_approval
  from public.agent_approvals as approval_record
  where approval_record.id = requested_approval_id
    and approval_record.action_id = locked_action.id
    and approval_record.institution_id = locked_action.institution_id
  for update;

  if not found
    or locked_approval.status <> 'pending'
    or locked_approval.requested_from_role <> expected_decision_role
    or locked_approval.requested_by_user_id = deciding_user_id
    or locked_approval.tool_key <> locked_action.tool_key
    or locked_approval.input_fingerprint <> locked_action.input_fingerprint
  then
    raise exception 'Agent approval is not eligible for this decision';
  end if;

  if locked_approval.expires_at <= decision_timestamp then
    update public.agent_approvals as approval_record
    set status = 'expired',
        updated_at = decision_timestamp
    where approval_record.id = locked_approval.id;

    update public.agent_actions as action_record
    set status = 'refused',
        updated_at = decision_timestamp
    where action_record.id = locked_action.id;

    return query
    select locked_approval.id, locked_action.id, 'expired'::text, decision_timestamp;
    return;
  end if;

  update public.agent_approvals as approval_record
  set status = requested_decision,
      decision_by_user_id = deciding_user_id,
      decision_role = expected_decision_role,
      decision_reason = clean_reason,
      decided_at = decision_timestamp,
      updated_at = decision_timestamp
  where approval_record.id = locked_approval.id;

  if requested_decision = 'rejected' then
    update public.agent_actions as action_record
    set status = 'refused',
        updated_at = decision_timestamp
    where action_record.id = locked_action.id;
  end if;

  return query
  select locked_approval.id, locked_action.id, requested_decision, decision_timestamp;
end;
$$;

revoke all on function public.agent_validate_action_service_scope()
from public, anon, authenticated;
revoke all on function public.agent_decide_approval(
  uuid,
  uuid,
  uuid,
  text,
  text[],
  boolean,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.agent_validate_action_service_scope()
to service_role;
grant execute on function public.agent_decide_approval(
  uuid,
  uuid,
  uuid,
  text,
  text[],
  boolean,
  text,
  text
)
to service_role;

comment on column public.agent_actions.service_code is
  'Immutable service scope used by the human approval inbox.';
comment on function public.agent_decide_approval(
  uuid,
  uuid,
  uuid,
  text,
  text[],
  boolean,
  text,
  text
) is
  'Atomically approves, rejects or expires one scoped A3 approval under fixed lock ordering.';

commit;
