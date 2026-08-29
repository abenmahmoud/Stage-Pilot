begin;

alter table public.agent_skill_audit
  drop constraint agent_skill_audit_action_check;

alter table public.agent_skill_audit
  add constraint agent_skill_audit_action_check check (
    action in (
      'create', 'create_version', 'update', 'submit_review', 'publish',
      'retire', 'rollback', 'expire', 'revoke', 'reserve_upload',
      'confirm_upload', 'reject_upload', 'queue_analysis',
      'complete_analysis', 'review_document', 'consult_public'
    )
  );

comment on column public.agent_skill_audit.action is
  'Governance action or minimal usage event; consult_public never stores message content.';

commit;
