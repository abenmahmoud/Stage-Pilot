begin;

create or replace function public.agent_expire_approvals(
  requested_institution_id uuid,
  allowed_service_codes text[],
  allow_all_services boolean
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked_action public.agent_actions%rowtype;
  locked_approval public.agent_approvals%rowtype;
  expiry_timestamp timestamptz := transaction_timestamp();
  expired_count integer := 0;
begin
  if requested_institution_id is null
    or array_position(coalesce(allowed_service_codes, array[]::text[]), null) is not null
    or not (
      coalesce(allowed_service_codes, array[]::text[]) <@ array[
        'referent_numerique',
        'ddfpt',
        'secretariat',
        'vie_scolaire',
        'intendance',
        'direction',
        'administration'
      ]::text[]
    )
  then
    raise exception 'Approval expiry scope is invalid';
  end if;

  if not coalesce(allow_all_services, false)
    and cardinality(coalesce(allowed_service_codes, array[]::text[])) = 0
  then
    return 0;
  end if;

  for locked_action in
    select action_record.*
    from public.agent_actions as action_record
    inner join public.agent_approvals as approval_record
      on approval_record.action_id = action_record.id
      and approval_record.institution_id = action_record.institution_id
    where action_record.institution_id = requested_institution_id
      and action_record.authority_level = 'A3'
      and action_record.status = 'awaiting_approval'
      and approval_record.status in ('pending', 'approved')
      and approval_record.consumed_at is null
      and approval_record.expires_at <= expiry_timestamp
      and (
        coalesce(allow_all_services, false)
        or action_record.service_code = any(
          coalesce(allowed_service_codes, array[]::text[])
        )
      )
    order by action_record.id
    for update of action_record skip locked
  loop
    select approval_record.* into locked_approval
    from public.agent_approvals as approval_record
    where approval_record.action_id = locked_action.id
      and approval_record.institution_id = locked_action.institution_id
    for update;

    if not found
      or locked_approval.status not in ('pending', 'approved')
      or locked_approval.consumed_at is not null
      or locked_approval.expires_at > expiry_timestamp
    then
      continue;
    end if;

    update public.agent_approvals as approval_record
    set status = 'expired',
        updated_at = expiry_timestamp
    where approval_record.id = locked_approval.id;

    update public.agent_actions as action_record
    set status = 'refused',
        updated_at = expiry_timestamp
    where action_record.id = locked_action.id;

    expired_count := expired_count + 1;
  end loop;

  return expired_count;
end;
$$;

create or replace function public.agent_write_approval_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  audit_event text;
  audit_actor uuid;
  audit_role text;
begin
  if tg_op = 'INSERT' then
    audit_event := 'approval_requested';
    audit_actor := new.requested_by_user_id;
    audit_role := new.requested_from_role;
  elsif old.status <> new.status then
    audit_event := case new.status
      when 'approved' then 'approval_approved'
      when 'rejected' then 'approval_rejected'
      when 'expired' then 'approval_expired'
      when 'cancelled' then 'approval_cancelled'
      else null
    end;
    if new.status = 'expired' then
      audit_actor := null;
      audit_role := 'system';
    else
      audit_actor := new.decision_by_user_id;
      audit_role := new.decision_role;
    end if;
  elsif old.consumed_at is null and new.consumed_at is not null then
    audit_event := 'approval_consumed';
    audit_actor := new.requested_by_user_id;
    audit_role := coalesce(new.decision_role, new.requested_from_role);
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
      audit_role,
      jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end;
$$;

revoke all on function public.agent_expire_approvals(uuid, text[], boolean)
from public, anon, authenticated;
revoke all on function public.agent_write_approval_audit()
from public, anon, authenticated;

grant execute on function public.agent_expire_approvals(uuid, text[], boolean)
to service_role;
grant execute on function public.agent_write_approval_audit()
to service_role;

comment on function public.agent_expire_approvals(uuid, text[], boolean) is
  'Closes and audits expired A3 approvals under service scope and fixed action-first row locks.';

commit;
