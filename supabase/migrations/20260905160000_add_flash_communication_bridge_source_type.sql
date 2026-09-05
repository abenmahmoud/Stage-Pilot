begin;

-- LOT 4 (plan de publication publique, 2026-09-05,
-- docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md) : raccorder la publication
-- flash a la file durable existante de la spec 005 (centre de communication),
-- jamais en batir une seconde (regle commune n4 du plan). Une publication
-- flash importante/urgente cree desormais, dans la MEME transaction que
-- l'ecriture deja existante de `flash_notification_dispatches` (LOT 3), un
-- double prive dans `communications` / `communication_versions` /
-- `communication_audiences`, puis met en file un travail
-- `communication_jobs` de type `prepare_delivery` -- exactement le mecanisme
-- deja utilise par le reste du centre de communication (job policy, claim,
-- completion), jamais une reimplementation.
--
-- Seul le CHECK de colonne `source_type` doit etre etendu (meme convention
-- que les migrations 20260905140000 et 20260905150000 : nom auto-genere
-- <table>_<colonne>_check pour un check de colonne unique) : la fondation du
-- 30 aout 2026 n'anticipait que 'direct_text', 'pdf', 'docx', 'image' et
-- 'forwarded_email' comme origines possibles d'une communication.
--
-- Rappel important, verifie par lecture des migrations existantes avant
-- d'ecrire ce pont (voir docs/operations/night-logs/PUBLIC-LOT4.md) :
-- `communication_deliveries.channel` reste limite a 'email' seul depuis sa
-- creation (20260830053500), jamais etendu a 'push' ou 'sms'. Aucun
-- fournisseur ni aucune table push n'existe nulle part dans ce depot. Ce pont
-- ne raccorde donc que les cibles de canal email d'une publication flash ;
-- les cibles push et sms restent hors de la file durable existante tant que
-- ce CHECK n'est pas etendu par une decision explicite et validee -- ce
-- n'est pas ce lot qui l'etend, volontairement.
alter table public.communications
  drop constraint if exists communications_source_type_check,
  add constraint communications_source_type_check check (
    source_type in ('direct_text', 'pdf', 'docx', 'image', 'forwarded_email', 'flash_info')
  );

comment on constraint communications_source_type_check on public.communications is
  'flash_info ajoute par LOT 4 du plan de publication publique (2026-09-05) : double prive cree a la publication d''une information flash importante ou urgente, pour raccorder son canal email a la file durable existante sans en creer une seconde.';

commit;
