begin;

-- LOT 3 (plan de publication publique, 2026-09-05,
-- docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md) : la publication ecrit
-- desormais une trace dans `flash_notification_dispatches`, mais tant que les
-- drapeaux d'envoi restent fermes cette trace ne peut jamais valoir `sent`
-- (ce serait mentir sur ce qui a reellement notifie quelqu'un, et casserait
-- silencieusement le calcul des trois ensembles de
-- shared/flash-audience-correction.ts, qui filtre precisement sur `sent`
-- pour ne compter que les envois reels). Un nouvel etat `simulated` porte
-- cette distinction.
--
-- Seul le check de colonne `status` doit etre etendu (meme convention que la
-- migration 20260905140000 : nom auto-genere <table>_<colonne>_check pour un
-- check de colonne unique).
alter table public.flash_notification_dispatches
  drop constraint if exists flash_notification_dispatches_status_check,
  add constraint flash_notification_dispatches_status_check check (
    status in ('sent', 'simulated', 'skipped', 'failed')
  );

-- Idempotence explicite (LOT 3, "republier ou rejouer ne double aucune
-- ligne") : en plus de la garde applicative (la route de publication ne
-- rejoue ce calcul que sur la transition validee -> publiee, jamais sur une
-- version deja `publiee`), deux index uniques partiels empechent toute
-- double ligne au niveau base, quel que soit l'appelant. Les deux moities de
-- la contrainte CHECK existante (`channel in ('push','email') => group_ref`
-- et `channel = 'sms' => contact_ref`) se refletent ici en deux index
-- distincts, chacun filtre sur la colonne qu'il couvre.
create unique index flash_notification_dispatches_version_channel_group_uidx
  on public.flash_notification_dispatches (version_id, channel, group_ref)
  where group_ref is not null;
create unique index flash_notification_dispatches_version_channel_contact_uidx
  on public.flash_notification_dispatches (version_id, channel, contact_ref)
  where contact_ref is not null;

-- Personnes choisies pour le canal SMS d'une version (§13, "SMS aux seules
-- personnes choisies, jamais a un groupe"). Meme forme que
-- `flash_info_audiences` (LOT 1 de la fondation), mais une table distincte :
-- l'audience gouverne la visibilite et les canaux de groupe (push/email),
-- ceci ne gouverne que la liste, separee, des destinataires individuels du
-- SMS. `contact_ref` reprend exactement le motif deja impose par la colonne
-- `flash_notification_dispatches.contact_ref`.
create table public.flash_info_sms_contacts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  version_id uuid not null,
  contact_ref text not null check (
    contact_ref ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$' and position('@' in contact_ref) = 0
  ),
  created_at timestamptz not null default transaction_timestamp(),
  unique (id, institution_id),
  unique (version_id, contact_ref),
  foreign key (version_id, institution_id)
    references public.flash_info_versions(id, institution_id) on delete restrict
);

create index flash_info_sms_contacts_version_scope_idx
  on public.flash_info_sms_contacts (version_id, institution_id);
create index flash_info_sms_contacts_scope_contact_idx
  on public.flash_info_sms_contacts (institution_id, contact_ref);

alter table public.flash_info_sms_contacts enable row level security;
alter table public.flash_info_sms_contacts force row level security;

revoke all on table public.flash_info_sms_contacts from public, anon, authenticated;
grant select, insert on table public.flash_info_sms_contacts to service_role;

comment on table public.flash_info_sms_contacts is
  'Personnes choisies pour le canal SMS d''une version d''information flash (LOT 3, plan de publication publique). Distinct de flash_info_audiences : ne gouverne ni la visibilite ni les canaux de groupe.';
comment on column public.flash_notification_dispatches.status is
  'sent = envoi reel confirme ; simulated = trace ecrite a la publication tant que les drapeaux d''envoi sont fermes, jamais un envoi reel ; skipped/failed = issus du traitement de la file (LOT 4).';

commit;
