begin;

-- LOT 6 du plan de connaissance OB1 (2026-09-05). `api/cron/knowledge-expiry.ts`
-- (et, depuis ce lot, `api/_shared/knowledge-freshness-sweep.ts`, rejoué par
-- les routes de publication) enregistre `action: 'expire_automatic'` pour une
-- source expirée sans acteur humain et `action: 'disable_automatic'` pour une
-- compétence désactivée en conséquence. Ces deux valeurs n'ont jamais été
-- ajoutées à `agent_skill_audit_action_check` : la première exécution réelle
-- de ce balayage contre PostgreSQL (recette LOT 6,
-- scripts/test-local-knowledge-freshness-sweep.mjs) a fait échouer l'insertion
-- d'audit et, par transaction, annulé aussi la mise à jour de péremption
-- elle-même — défaut latent présent depuis la création du cron, jamais
-- détecté faute d'avoir été rejoué contre une base réelle avec des données
-- effectivement expirées.
alter table public.agent_skill_audit
  drop constraint agent_skill_audit_action_check;

alter table public.agent_skill_audit
  add constraint agent_skill_audit_action_check check (
    action in (
      'create', 'create_version', 'update', 'submit_review', 'publish',
      'retire', 'rollback', 'expire', 'revoke', 'reserve_upload',
      'confirm_upload', 'reject_upload', 'queue_analysis',
      'complete_analysis', 'review_document', 'consult_public',
      'access_document', 'purge_document', 'fail_purge',
      'propose_knowledge_source', 'review_knowledge_proposal',
      'expire_automatic', 'disable_automatic'
    )
  );

comment on column public.agent_skill_audit.action is
  'Governance action or minimal usage event; consult_public never stores message content. expire_automatic/disable_automatic never carry a human actor_id.';

commit;
