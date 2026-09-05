begin;

-- LOT 2 (persistance flash) : POST /api/flash/proposals doit etre idempotent
-- sur un double envoi, meme motif que public.support_requests.idempotency_key_hash
-- (supabase/migrations pour la file support). Le hash vient du header client
-- Idempotency-Key ; jamais la valeur brute, jamais le corps de la requete.
alter table public.flash_infos
  add column idempotency_key_hash text not null;

alter table public.flash_infos
  add constraint flash_infos_idempotency_key_hash_check
  check (idempotency_key_hash ~ '^[0-9a-f]{64}$');

create unique index flash_infos_institution_idempotency_uidx
  on public.flash_infos (institution_id, idempotency_key_hash);

comment on column public.flash_infos.idempotency_key_hash is
  'sha256 hex du header Idempotency-Key fourni par le client a la proposition. Un double envoi avec la meme cle, dans le meme etablissement, ne cree jamais une seconde ligne.';

commit;
