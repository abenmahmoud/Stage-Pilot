begin;

-- LOT 7 du plan de connaissance OB1 (2026-09-05) : correction d'un manque
-- fonctionnel demontre par le test adverse 9 (« deux requetes identiques ne
-- creent pas de doublon »). `api/flash/proposals/[id]/knowledge.ts` garantit
-- deja l'idempotence pour une proposition issue d'une actualite publiee
-- (verification `existingBlocks` avant insertion). `api/knowledge/admin/
-- proposals/index.ts` (proposition « issue d'une discussion ») n'avait aucune
-- garantie equivalente : deux soumissions identiques creaient deux lignes.
--
-- Meme motif que `flash_infos.idempotency_key_hash`
-- (20260905110000_add_flash_proposal_idempotency.sql) : le client fournit un
-- identifiant d'envoi dans l'en-tete `Idempotency-Key`, jamais dans le corps
-- de la requete (le corps n'est pas fiable pour rejouer un envoi identique,
-- et comparer le texte propose echouerait des qu'un signal de vie privee
-- retire ce texte avant stockage). Seul le hash est conserve, jamais la
-- valeur brute.
--
-- Nul pour une proposition 'flash_publication' : cette origine a deja sa
-- propre garantie d'unicite (une seule proposition active a la fois par
-- actualite, verifiee cote route). Un index unique simple (non partiel)
-- suffit : Postgres ne compare jamais deux valeurs NULL comme egales, donc
-- les lignes 'flash_publication' (hash toujours NULL) ne se bloquent jamais
-- entre elles ni avec une ligne 'conversation'.
alter table public.knowledge_source_proposals
  add column idempotency_key_hash text;

alter table public.knowledge_source_proposals
  add constraint knowledge_source_proposals_idempotency_key_hash_check
  check (idempotency_key_hash is null or idempotency_key_hash ~ '^[0-9a-f]{64}$');

alter table public.knowledge_source_proposals
  add constraint knowledge_source_proposals_idempotency_key_hash_origin_check
  check (
    (origin = 'conversation' and idempotency_key_hash is not null)
    or (origin = 'flash_publication' and idempotency_key_hash is null)
  );

create unique index knowledge_source_proposals_institution_idempotency_uidx
  on public.knowledge_source_proposals (institution_id, idempotency_key_hash);

comment on column public.knowledge_source_proposals.idempotency_key_hash is
  'sha256 hex du header Idempotency-Key fourni par le client a la soumission d''une proposition issue d''une discussion. Un double envoi avec la meme cle, dans le meme etablissement, ne cree jamais une seconde ligne. Toujours NULL pour une proposition issue d''une actualite publiee (garantie deja assuree ailleurs).';

-- Champ declaratif pose a la creation : immuable comme les autres, meme
-- garde que knowledge_source_proposals_immutable_origin_guard (LOT 5).
create or replace function public.knowledge_source_proposals_immutable_origin_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.institution_id is distinct from old.institution_id
    or new.origin is distinct from old.origin
    or new.origin_conversation_id is distinct from old.origin_conversation_id
    or new.origin_flash_info_id is distinct from old.origin_flash_info_id
    or new.origin_flash_version_id is distinct from old.origin_flash_version_id
    or new.title is distinct from old.title
    or new.proposed_text is distinct from old.proposed_text
    or new.privacy_signals is distinct from old.privacy_signals
    or new.classification is distinct from old.classification
    or new.service_codes is distinct from old.service_codes
    or new.valid_from is distinct from old.valid_from
    or new.expires_at is distinct from old.expires_at
    or new.provenance_status is distinct from old.provenance_status
    or new.use_policy is distinct from old.use_policy
    or new.proposed_by is distinct from old.proposed_by
    or new.idempotency_key_hash is distinct from old.idempotency_key_hash
    or new.created_at is distinct from old.created_at then
    raise exception 'knowledge_source_proposals_origin_is_immutable';
  end if;
  return new;
end;
$$;

commit;

-- ---------------------------------------------------------------------------
-- Migration inverse (non appliquee automatiquement ; meme convention que les
-- migrations precedentes de ce dossier, pas de fichier `down`) :
--
-- begin;
-- create or replace function public.knowledge_source_proposals_immutable_origin_guard()
-- returns trigger
-- language plpgsql
-- security invoker
-- set search_path = ''
-- as $$
-- begin
--   if new.institution_id is distinct from old.institution_id
--     or new.origin is distinct from old.origin
--     or new.origin_conversation_id is distinct from old.origin_conversation_id
--     or new.origin_flash_info_id is distinct from old.origin_flash_info_id
--     or new.origin_flash_version_id is distinct from old.origin_flash_version_id
--     or new.title is distinct from old.title
--     or new.proposed_text is distinct from old.proposed_text
--     or new.privacy_signals is distinct from old.privacy_signals
--     or new.classification is distinct from old.classification
--     or new.service_codes is distinct from old.service_codes
--     or new.valid_from is distinct from old.valid_from
--     or new.expires_at is distinct from old.expires_at
--     or new.provenance_status is distinct from old.provenance_status
--     or new.use_policy is distinct from old.use_policy
--     or new.proposed_by is distinct from old.proposed_by
--     or new.created_at is distinct from old.created_at then
--     raise exception 'knowledge_source_proposals_origin_is_immutable';
--   end if;
--   return new;
-- end;
-- $$;
-- drop index if exists public.knowledge_source_proposals_institution_idempotency_uidx;
-- alter table public.knowledge_source_proposals
--   drop constraint if exists knowledge_source_proposals_idempotency_key_hash_origin_check;
-- alter table public.knowledge_source_proposals
--   drop constraint if exists knowledge_source_proposals_idempotency_key_hash_check;
-- alter table public.knowledge_source_proposals
--   drop column if exists idempotency_key_hash;
-- commit;
