begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000007501',
  'authenticated', 'authenticated', 'communication-runner@example.test', '',
  transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, transaction_timestamp(), transaction_timestamp()
);

insert into public.institutions (id, slug, name, status) values (
  '00000000-0000-4000-8000-000000007502',
  'communication-runner-preview',
  'Communication Runner Preview',
  'draft'
);

insert into public.communication_settings (
  institution_id, module_enabled, publication_enabled, sending_enabled, updated_by
) values (
  '00000000-0000-4000-8000-000000007502', true, true, true,
  '00000000-0000-4000-8000-000000007501'
);

insert into public.communications (
  id, institution_id, source_type, source_fingerprint, source_label, created_by
) values (
  '00000000-0000-4000-8000-000000007510',
  '00000000-0000-4000-8000-000000007502',
  'direct_text', repeat('7', 64), 'Recette fictive du runner',
  '00000000-0000-4000-8000-000000007501'
);

insert into public.communication_versions (
  id, institution_id, communication_id, version, title, summary,
  body_markdown, content_hash, created_by
) values (
  '00000000-0000-4000-8000-000000007520',
  '00000000-0000-4000-8000-000000007502',
  '00000000-0000-4000-8000-000000007510', 1,
  'Information fictive', 'Résumé fictif', 'Contenu strictement fictif.',
  repeat('8', 64), '00000000-0000-4000-8000-000000007501'
);

update public.communication_versions
set status = 'review'
where id = '00000000-0000-4000-8000-000000007520';

update public.communications
set status = 'review'
where id = '00000000-0000-4000-8000-000000007510';

update public.communication_versions
set status = 'approved',
    approved_by = '00000000-0000-4000-8000-000000007501',
    approved_at = transaction_timestamp()
where id = '00000000-0000-4000-8000-000000007520';

update public.communications
set status = 'approved',
    approved_by = '00000000-0000-4000-8000-000000007501',
    approved_at = transaction_timestamp()
where id = '00000000-0000-4000-8000-000000007510';

insert into public.communication_deliveries (
  id, institution_id, communication_id, version_id, version, contact_ref,
  status, idempotency_key_hash, resolution_hash, command_hash, queued_at
)
select
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000007502'::uuid,
  '00000000-0000-4000-8000-000000007510'::uuid,
  '00000000-0000-4000-8000-000000007520'::uuid,
  1,
  'contact:fictive:' || lpad(sequence::text, 4, '0'),
  'queued',
  md5('delivery-idempotency-a-' || sequence) || md5('delivery-idempotency-b-' || sequence),
  md5('resolution-a-' || sequence) || md5('resolution-b-' || sequence),
  md5('command-a-' || sequence) || md5('command-b-' || sequence),
  transaction_timestamp()
from generate_series(1, 200) as sequence;

insert into public.communication_jobs (
  id, institution_id, communication_id, version_id, version, delivery_id,
  job_type, status, idempotency_key_hash, run_after
)
select
  gen_random_uuid(), delivery.institution_id, delivery.communication_id,
  delivery.version_id, delivery.version, delivery.id, 'send_delivery', 'pending',
  md5('job-idempotency-a-' || delivery.contact_ref) || md5('job-idempotency-b-' || delivery.contact_ref),
  transaction_timestamp()
from public.communication_deliveries as delivery
where delivery.institution_id = '00000000-0000-4000-8000-000000007502';

with ranked as (
  select id, row_number() over (order by contact_ref) as position
  from public.communication_deliveries
  where institution_id = '00000000-0000-4000-8000-000000007502'
), claimed as (
  select job.id
  from public.communication_jobs as job
  join ranked on ranked.id = job.delivery_id
  where ranked.position <= 190
)
update public.communication_jobs as job
set status = 'running', locked_at = transaction_timestamp()
from claimed
where job.id = claimed.id;

with ranked as (
  select id, row_number() over (order by contact_ref) as position
  from public.communication_deliveries
  where institution_id = '00000000-0000-4000-8000-000000007502'
)
update public.communication_deliveries as delivery
set status = 'sent',
    provider_message_ref = md5('provider-a-' || ranked.position) || md5('provider-b-' || ranked.position),
    webmail_receipt_hash = md5('receipt-a-' || ranked.position) || md5('receipt-b-' || ranked.position),
    sent_at = transaction_timestamp(), attempt_count = 1
from ranked
where delivery.id = ranked.id and ranked.position <= 160;

update public.communication_jobs as job
set status = 'completed', completed_at = transaction_timestamp(), locked_at = null
from public.communication_deliveries as delivery
where job.delivery_id = delivery.id
  and delivery.institution_id = '00000000-0000-4000-8000-000000007502'
  and delivery.status = 'sent';

with ranked as (
  select id, row_number() over (order by contact_ref) as position
  from public.communication_deliveries
  where institution_id = '00000000-0000-4000-8000-000000007502'
)
update public.communication_deliveries as delivery
set status = 'error', last_error_code = 'provider_unavailable', attempt_count = 1
from ranked
where delivery.id = ranked.id and ranked.position between 161 and 180;

update public.communication_jobs as job
set status = 'retry', attempt_count = 1, last_error_code = 'provider_unavailable',
    run_after = transaction_timestamp() + interval '5 minutes', locked_at = null
from public.communication_deliveries as delivery
where job.delivery_id = delivery.id
  and delivery.institution_id = '00000000-0000-4000-8000-000000007502'
  and delivery.last_error_code = 'provider_unavailable';

with ranked as (
  select id, row_number() over (order by contact_ref) as position
  from public.communication_deliveries
  where institution_id = '00000000-0000-4000-8000-000000007502'
)
update public.communication_deliveries as delivery
set status = 'error', last_error_code = 'authorization_failed', attempt_count = 5
from ranked
where delivery.id = ranked.id and ranked.position between 181 and 190;

update public.communication_jobs as job
set status = 'dead', attempt_count = 5, last_error_code = 'authorization_failed',
    locked_at = null
from public.communication_deliveries as delivery
where job.delivery_id = delivery.id
  and delivery.institution_id = '00000000-0000-4000-8000-000000007502'
  and delivery.last_error_code = 'authorization_failed';

insert into public.communication_events (
  institution_id, communication_id, resource_type, resource_id, event_type,
  actor_type, external_event_hash, summary
)
select
  delivery.institution_id, delivery.communication_id, 'delivery', delivery.id,
  'delivery.sent', 'provider', delivery.webmail_receipt_hash,
  jsonb_build_object('provider', 'brevo_transactional', 'outcome', 'accepted')
from public.communication_deliveries as delivery
where delivery.institution_id = '00000000-0000-4000-8000-000000007502'
  and delivery.status = 'sent';

do $$
declare
  duplicate_command_blocked boolean := false;
  duplicate_receipt_event_blocked boolean := false;
  command_mutation_blocked boolean := false;
  sent_count integer;
  retry_count integer;
  dead_count integer;
  pending_count integer;
begin
  begin
    insert into public.communication_deliveries (
      institution_id, communication_id, version_id, version, contact_ref,
      status, idempotency_key_hash, resolution_hash, command_hash, queued_at
    )
    select
      institution_id, communication_id, version_id, version,
      'contact:fictive:duplicate', 'queued', repeat('9', 64), repeat('a', 64),
      command_hash, transaction_timestamp()
    from public.communication_deliveries
    where institution_id = '00000000-0000-4000-8000-000000007502'
    order by contact_ref limit 1;
  exception when unique_violation then
    duplicate_command_blocked := true;
  end;

  begin
    insert into public.communication_events (
      institution_id, communication_id, resource_type, resource_id, event_type,
      actor_type, external_event_hash, summary
    )
    select institution_id, communication_id, 'delivery', id, 'delivery.sent',
      'provider', webmail_receipt_hash, '{}'::jsonb
    from public.communication_deliveries
    where institution_id = '00000000-0000-4000-8000-000000007502'
      and status = 'sent'
    order by contact_ref limit 1;
  exception when unique_violation then
    duplicate_receipt_event_blocked := true;
  end;

  begin
    update public.communication_deliveries
    set command_hash = repeat('b', 64)
    where id = (
      select id from public.communication_deliveries
      where institution_id = '00000000-0000-4000-8000-000000007502'
        and status = 'sent'
      order by contact_ref limit 1
    );
  exception when raise_exception then
    command_mutation_blocked := sqlerrm = 'Communication delivery identity is immutable';
  end;

  select count(*) filter (where status = 'sent'),
         count(*) filter (where status = 'error' and last_error_code = 'provider_unavailable'),
         count(*) filter (where status = 'error' and last_error_code = 'authorization_failed'),
         count(*) filter (where status = 'queued')
  into sent_count, retry_count, dead_count, pending_count
  from public.communication_deliveries
  where institution_id = '00000000-0000-4000-8000-000000007502';

  if not (
    duplicate_command_blocked and duplicate_receipt_event_blocked
    and command_mutation_blocked and sent_count = 160 and retry_count = 20
    and dead_count = 10 and pending_count = 10
    and (select count(*) from public.communication_jobs
         where institution_id = '00000000-0000-4000-8000-000000007502') = 200
    and (select count(*) from public.communication_events
         where institution_id = '00000000-0000-4000-8000-000000007502') = 160
  ) then
    raise exception 'Communication Webmail handshake recipe failed';
  end if;
end;
$$;

rollback;

select
  (select count(*) from auth.users where id = '00000000-0000-4000-8000-000000007501') as auth_residue,
  (select count(*) from public.institutions where id = '00000000-0000-4000-8000-000000007502') as institution_residue,
  (select count(*) from public.communication_deliveries where institution_id = '00000000-0000-4000-8000-000000007502') as delivery_residue,
  (select count(*) from public.communication_jobs where institution_id = '00000000-0000-4000-8000-000000007502') as job_residue,
  (select count(*) from public.communication_events where institution_id = '00000000-0000-4000-8000-000000007502') as event_residue;
