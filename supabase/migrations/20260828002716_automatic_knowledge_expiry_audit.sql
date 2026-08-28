-- Automatic maintenance events are not performed by a human account.
alter table public.agent_skill_audit
  alter column actor_id drop not null;

comment on column public.agent_skill_audit.actor_id is
  'Human actor when applicable; null for an automatic system action.';
