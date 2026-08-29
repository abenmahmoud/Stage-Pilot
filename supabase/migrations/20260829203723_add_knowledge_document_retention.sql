begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.knowledge_documents
  add column retention_policy_key text not null default 'pending_dpo',
  add column retention_until timestamptz,
  add column purge_status text not null default 'blocked',
  add column purge_requested_at timestamptz,
  add column purge_started_at timestamptz,
  add column purged_at timestamptz,
  add column last_purge_error text;

alter table public.knowledge_documents
  drop constraint if exists knowledge_documents_status_check,
  add constraint knowledge_documents_status_check check (
    status in (
      'reserved', 'uploaded', 'quarantined', 'processing', 'review',
      'ready', 'rejected', 'failed', 'purged'
    )
  ),
  add constraint knowledge_documents_retention_policy_check check (
    retention_policy_key in ('pending_dpo', 'approved')
  ),
  add constraint knowledge_documents_purge_status_check check (
    purge_status in ('blocked', 'scheduled', 'processing', 'failed', 'purged')
  ),
  add constraint knowledge_documents_retention_closed_by_default_check check (
    (
      retention_policy_key = 'pending_dpo'
      and retention_until is null
      and purge_status = 'blocked'
    )
    or (
      retention_policy_key = 'approved'
      and retention_until is not null
    )
  ),
  add constraint knowledge_documents_purged_state_check check (
    (status = 'purged' and purge_status = 'purged' and purged_at is not null)
    or (status <> 'purged' and purge_status <> 'purged' and purged_at is null)
  ),
  add constraint knowledge_documents_purge_error_length_check check (
    last_purge_error is null or length(last_purge_error) <= 240
  );

create index knowledge_documents_purge_due_idx
  on public.knowledge_documents (retention_until, created_at)
  where retention_policy_key = 'approved'
    and purge_status in ('scheduled', 'failed')
    and source_id is null;

alter table public.agent_skill_audit
  drop constraint agent_skill_audit_action_check;

alter table public.agent_skill_audit
  add constraint agent_skill_audit_action_check check (
    action in (
      'create', 'create_version', 'update', 'submit_review', 'publish',
      'retire', 'rollback', 'expire', 'revoke', 'reserve_upload',
      'confirm_upload', 'reject_upload', 'queue_analysis',
      'complete_analysis', 'review_document', 'consult_public',
      'access_document', 'purge_document', 'fail_purge'
    )
  );

comment on column public.knowledge_documents.retention_policy_key is
  'pending_dpo blocks all purge; approved is set only after a documented direction/DPO policy.';
comment on column public.knowledge_documents.retention_until is
  'Physical purge eligibility date from an approved policy; never inferred by the agent.';
comment on column public.knowledge_documents.purge_status is
  'Worker lifecycle; blocked is the fail-closed default.';

commit;
