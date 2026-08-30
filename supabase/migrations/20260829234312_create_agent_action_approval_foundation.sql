begin;

create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  support_request_id uuid references public.support_requests(id) on delete set null,
  conversation_id uuid,
  skill_version_id uuid not null,
  tool_key text not null check (
    tool_key ~ '^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*)+$'
  ),
  authority_level text not null check (
    authority_level in ('A0', 'A1', 'A2', 'A3')
  ),
  input_redacted jsonb not null default '{}'::jsonb check (
    jsonb_typeof(input_redacted) = 'object'
  ),
  input_fingerprint text not null check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  status text not null check (
    status in ('planned', 'awaiting_approval', 'running', 'succeeded', 'failed', 'refused')
  ),
  idempotency_key_hash text not null check (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  requested_by_user_id uuid references auth.users(id) on delete restrict,
  requester_ref_hash text not null check (requester_ref_hash ~ '^[a-f0-9]{64}$'),
  tool_result jsonb check (tool_result is null or jsonb_typeof(tool_result) = 'object'),
  confirmation_ref text check (
    confirmation_ref is null
    or confirmation_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$'
  ),
  requested_at timestamptz not null default transaction_timestamp(),
  started_at timestamptz,
  confirmed_at timestamptz,
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (institution_id, idempotency_key_hash),
  unique (
    id,
    institution_id,
    tool_key,
    input_fingerprint,
    requested_by_user_id
  ),
  foreign key (skill_version_id, institution_id)
    references public.agent_skill_versions(id, institution_id) on delete restrict,
  check (authority_level <> 'A3' or requested_by_user_id is not null),
  check (started_at is null or started_at >= requested_at),
  check (confirmed_at is null or confirmed_at >= requested_at),
  check (
    (status = 'succeeded'
      and started_at is not null
      and confirmed_at is not null
      and confirmation_ref is not null
      and tool_result is not null)
    or (status <> 'succeeded' and confirmed_at is null and confirmation_ref is null)
  )
);

create index agent_actions_institution_status_created_idx
  on public.agent_actions (institution_id, status, requested_at desc);
create index agent_actions_support_request_idx
  on public.agent_actions (support_request_id)
  where support_request_id is not null;
create index agent_actions_skill_version_institution_fk_idx
  on public.agent_actions (skill_version_id, institution_id);

create table public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  action_id uuid not null,
  tool_key text not null,
  input_fingerprint text not null,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  requested_from_role text not null check (
    requested_from_role in ('staff', 'service_manager', 'direction', 'superadmin')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'expired', 'cancelled')
  ),
  decision_by_user_id uuid references auth.users(id) on delete restrict,
  decision_role text check (
    decision_role is null
    or decision_role in ('staff', 'service_manager', 'direction', 'superadmin')
  ),
  decision_reason text check (
    decision_reason is null
    or length(btrim(decision_reason)) between 2 and 500
  ),
  requested_at timestamptz not null default transaction_timestamp(),
  decided_at timestamptz,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  updated_at timestamptz not null default transaction_timestamp(),
  unique (action_id),
  unique (id, institution_id),
  foreign key (
    action_id,
    institution_id,
    tool_key,
    input_fingerprint,
    requested_by_user_id
  ) references public.agent_actions (
    id,
    institution_id,
    tool_key,
    input_fingerprint,
    requested_by_user_id
  ) on delete restrict,
  check (expires_at > requested_at),
  check (decision_by_user_id is null or decision_by_user_id <> requested_by_user_id),
  check (decision_role is null or decision_role = requested_from_role),
  check (
    (status = 'pending'
      and decision_by_user_id is null
      and decision_role is null
      and decision_reason is null
      and decided_at is null
      and consumed_at is null)
    or (status = 'approved'
      and decision_by_user_id is not null
      and decision_role is not null
      and decided_at is not null)
    or (status = 'rejected'
      and decision_by_user_id is not null
      and decision_role is not null
      and decision_reason is not null
      and decided_at is not null
      and consumed_at is null)
    or (status in ('expired', 'cancelled') and consumed_at is null)
  ),
  check (decided_at is null or decided_at < expires_at),
  check (
    consumed_at is null
    or (
      status = 'approved'
      and decided_at is not null
      and consumed_at >= decided_at
      and consumed_at < expires_at
    )
  )
);

create index agent_approvals_institution_status_expiry_idx
  on public.agent_approvals (institution_id, status, expires_at);
create index agent_approvals_action_institution_fk_idx
  on public.agent_approvals (action_id, institution_id);

create table public.agent_action_audit (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  action_id uuid not null,
  approval_id uuid,
  event_type text not null check (
    event_type in (
      'action_created', 'approval_requested', 'approval_approved',
      'approval_rejected', 'approval_expired', 'approval_cancelled',
      'approval_consumed', 'action_started', 'action_succeeded',
      'action_failed', 'action_refused'
    )
  ),
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_role text,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default transaction_timestamp(),
  foreign key (action_id, institution_id)
    references public.agent_actions(id, institution_id) on delete restrict,
  foreign key (approval_id, institution_id)
    references public.agent_approvals(id, institution_id) on delete restrict
);

create index agent_action_audit_action_created_idx
  on public.agent_action_audit (action_id, created_at desc);
create index agent_action_audit_institution_created_idx
  on public.agent_action_audit (institution_id, created_at desc);
create index agent_action_audit_approval_institution_fk_idx
  on public.agent_action_audit (approval_id, institution_id)
  where approval_id is not null;

create or replace function public.agent_validate_action_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Agent actions are append-only records';
  end if;

  if tg_op = 'INSERT' then
    if (new.authority_level = 'A3' and new.status <> 'awaiting_approval')
      or (new.authority_level <> 'A3' and new.status <> 'planned')
    then
      raise exception 'Invalid initial agent action status';
    end if;
    return new;
  end if;

  if old.institution_id <> new.institution_id
    or old.skill_version_id <> new.skill_version_id
    or old.tool_key <> new.tool_key
    or old.authority_level <> new.authority_level
    or old.input_redacted <> new.input_redacted
    or old.input_fingerprint <> new.input_fingerprint
    or old.idempotency_key_hash <> new.idempotency_key_hash
    or old.requested_by_user_id is distinct from new.requested_by_user_id
    or old.requester_ref_hash <> new.requester_ref_hash
    or old.requested_at <> new.requested_at
  then
    raise exception 'Agent action binding fields are immutable';
  end if;

  if old.status in ('succeeded', 'failed', 'refused') then
    raise exception 'Terminal agent action is immutable';
  end if;

  if old.status <> new.status and not (
    (old.status = 'planned' and new.status in ('running', 'failed', 'refused'))
    or (old.status = 'awaiting_approval' and new.status in ('running', 'failed', 'refused'))
    or (old.status = 'running' and new.status in ('succeeded', 'failed', 'refused'))
  ) then
    raise exception 'Invalid agent action status transition';
  end if;

  if old.status = 'awaiting_approval' and new.status = 'running' and not exists (
    select 1
    from public.agent_approvals approval
    where approval.action_id = new.id
      and approval.institution_id = new.institution_id
      and approval.tool_key = new.tool_key
      and approval.input_fingerprint = new.input_fingerprint
      and approval.requested_by_user_id = new.requested_by_user_id
      and approval.status = 'approved'
      and approval.consumed_at is not null
      and approval.consumed_at < approval.expires_at
  ) then
    raise exception 'A3 action requires a consumed approval';
  end if;

  if new.status = 'running' and new.started_at is null then
    raise exception 'Running agent action requires started_at';
  end if;

  if new.started_at is not null and new.started_at > transaction_timestamp() then
    raise exception 'Agent action start cannot be in the future';
  end if;

  if new.status = 'succeeded' and new.confirmed_at > transaction_timestamp() then
    raise exception 'Agent action confirmation cannot be in the future';
  end if;

  return new;
end;
$$;

create trigger agent_actions_validate_transition
before insert or update or delete on public.agent_actions
for each row execute function public.agent_validate_action_transition();

create trigger agent_actions_set_updated_at
before update on public.agent_actions
for each row execute function public.support_set_updated_at();

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
    old.status = 'pending' and new.status in ('approved', 'rejected', 'expired', 'cancelled')
  ) then
    raise exception 'Invalid agent approval status transition';
  end if;

  if new.status = 'approved' and (
    new.decided_at > transaction_timestamp()
    or new.expires_at <= transaction_timestamp()
  ) then
    raise exception 'Approval decision time is invalid';
  end if;

  if old.consumed_at is not null and new.consumed_at is distinct from old.consumed_at then
    raise exception 'Consumed approval is immutable';
  end if;

  return new;
end;
$$;

create trigger agent_approvals_validate_transition
before insert or update or delete on public.agent_approvals
for each row execute function public.agent_validate_approval_transition();

create trigger agent_approvals_set_updated_at
before update on public.agent_approvals
for each row execute function public.support_set_updated_at();

create or replace function public.agent_write_action_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  audit_event text;
begin
  if tg_op = 'INSERT' then
    audit_event := 'action_created';
  elsif old.status = new.status then
    return new;
  else
    audit_event := case new.status
      when 'running' then 'action_started'
      when 'succeeded' then 'action_succeeded'
      when 'failed' then 'action_failed'
      when 'refused' then 'action_refused'
      else null
    end;
  end if;

  if audit_event is not null then
    insert into public.agent_action_audit (
      institution_id,
      action_id,
      event_type,
      actor_user_id,
      summary
    ) values (
      new.institution_id,
      new.id,
      audit_event,
      new.requested_by_user_id,
      jsonb_build_object('status', new.status, 'toolKey', new.tool_key)
    );
  end if;
  return new;
end;
$$;

create trigger agent_actions_write_audit
after insert or update of status on public.agent_actions
for each row execute function public.agent_write_action_audit();

create or replace function public.agent_write_approval_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  audit_event text;
  audit_actor uuid;
begin
  if tg_op = 'INSERT' then
    audit_event := 'approval_requested';
    audit_actor := new.requested_by_user_id;
  elsif old.status <> new.status then
    audit_event := case new.status
      when 'approved' then 'approval_approved'
      when 'rejected' then 'approval_rejected'
      when 'expired' then 'approval_expired'
      when 'cancelled' then 'approval_cancelled'
      else null
    end;
    audit_actor := new.decision_by_user_id;
  elsif old.consumed_at is null and new.consumed_at is not null then
    audit_event := 'approval_consumed';
    audit_actor := new.requested_by_user_id;
  else
    return new;
  end if;

  if audit_event is not null then
    insert into public.agent_action_audit (
      institution_id,
      action_id,
      approval_id,
      event_type,
      actor_user_id,
      actor_role,
      summary
    ) values (
      new.institution_id,
      new.action_id,
      new.id,
      audit_event,
      audit_actor,
      coalesce(new.decision_role, new.requested_from_role),
      jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger agent_approvals_write_audit
after insert or update of status, consumed_at on public.agent_approvals
for each row execute function public.agent_write_approval_audit();

create or replace function public.agent_block_action_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Agent action audit is append-only';
end;
$$;

create trigger agent_action_audit_block_mutation
before update or delete on public.agent_action_audit
for each row execute function public.agent_block_action_audit_mutation();

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

  select * into locked_action
  from public.agent_actions
  where id = requested_action_id
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

  select * into locked_approval
  from public.agent_approvals
  where id = requested_approval_id
    and action_id = requested_action_id
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

  update public.agent_approvals
  set consumed_at = consumed_timestamp,
      updated_at = consumed_timestamp
  where id = locked_approval.id;

  update public.agent_actions
  set status = 'running',
      started_at = consumed_timestamp,
      updated_at = consumed_timestamp
  where id = locked_action.id;

  return query select locked_action.id, locked_approval.id, consumed_timestamp;
end;
$$;

revoke all on function public.agent_validate_action_transition()
from public, anon, authenticated;
revoke all on function public.agent_validate_approval_transition()
from public, anon, authenticated;
revoke all on function public.agent_write_action_audit()
from public, anon, authenticated;
revoke all on function public.agent_write_approval_audit()
from public, anon, authenticated;
revoke all on function public.agent_block_action_audit_mutation()
from public, anon, authenticated;
revoke all on function public.agent_consume_approval(uuid, uuid, uuid, text, text)
from public, anon, authenticated;

grant execute on function public.agent_validate_action_transition() to service_role;
grant execute on function public.agent_validate_approval_transition() to service_role;
grant execute on function public.agent_write_action_audit() to service_role;
grant execute on function public.agent_write_approval_audit() to service_role;
grant execute on function public.agent_block_action_audit_mutation() to service_role;
grant execute on function public.agent_consume_approval(uuid, uuid, uuid, text, text)
to service_role;

alter table public.agent_actions enable row level security;
alter table public.agent_actions force row level security;
alter table public.agent_approvals enable row level security;
alter table public.agent_approvals force row level security;
alter table public.agent_action_audit enable row level security;
alter table public.agent_action_audit force row level security;

revoke all on table
  public.agent_actions,
  public.agent_approvals,
  public.agent_action_audit
from public, anon, authenticated;

grant select, insert, update on table
  public.agent_actions,
  public.agent_approvals
to service_role;

grant select, insert on table public.agent_action_audit to service_role;

comment on function public.agent_consume_approval(uuid, uuid, uuid, text, text) is
  'Atomically consumes one bound, independent and unexpired A3 approval before tool execution.';

commit;
