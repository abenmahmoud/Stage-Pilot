# LOT 1 — Le dernier mètre : écrire les créneaux

Plan : `docs/operations/PLAN_DONNEES_REELLES_2026-09-06.md`. Périmètre exécuté
strictement : LOT 1 seulement. Branche `codex/lycee-connect-prototype`,
aucun `git push`.

## Constat de départ (vérifié, pas supposé)

Avant ce lot, aucun code n'écrivait dans `schedule_slots` — confirmé par
lecture directe de `api/schedule/admin/imports/**` : le circuit d'import
monte jusqu'à la page vérifiée (`schedule_page_indexes.review_status =
'verified'`) puis s'arrête. `schedule_page_indexes` ne contient qu'une
référence opaque de page → classe/professeur, jamais l'horaire, la matière
ou la salle. C'est le trou décrit par le plan, et il est bien unique : aucune
route, worker ni script n'insère dans `schedule_slots`.

Point important trouvé dans `specs/002-agent-etablissement-adaptatif/
schedule-import.md` (décision du 29 août) : l'extraction automatique de
texte depuis les PDF a été jugée **non fiable** (colonnes de groupes qui se
chevauchent) et volontairement remise à plus tard, après constitution d'un
jeu de contrôle. Ce lot ne construit donc **pas** d'extraction automatique —
il reste hors périmètre. Il ajoute un point d'écriture qui accepte les
créneaux d'une page **déjà vérifiée par un humain**, saisis (ou collés)
sous forme structurée. Cela ferme le trou signalé par Adel sans rouvrir le
problème de fiabilité déjà écarté en août.

## Ce qui a été construit

- `shared/schedule-slot-input.ts` — validation stricte d'un lot de créneaux
  (1 à 80 lignes), bornes alignées sur les contraintes réelles de la table
  (voir plus bas), rejet des doublons dans un même envoi.
- `api/_shared/schedule-slot-write.ts` — **point d'écriture unique** de
  `schedule_slots` : `writeScheduleSlots(tx, params)`. N'écrit que si la page
  est vérifiée et la version encore en `review`. Remplace intégralement les
  créneaux existants de cette page à chaque appel (delete puis insert dans
  la même transaction) : un renvoi corrige, il ne duplique jamais. Volontairement
  indépendant de `api/_shared/auth.ts` (pas d'import du client Supabase) pour
  rester appelable depuis une recette locale sans variables d'environnement.
- `api/schedule/admin/imports/[id]/pages/[pageId]/slots.ts` — route POST,
  `requireScheduleManager`, `sizeLimit: "16kb"`, traduit les erreurs du point
  d'écriture en `HttpError`.
- `scripts/test-schedule-slot-input.mjs` — tests unitaires du validateur.
- `scripts/test-local-schedule-slot-write-point.mjs` — recette PostgreSQL
  locale réelle (voir plus bas).
- Migration `supabase/migrations/20260906200000_add_schedule_audit_write_slots_action.sql`
  — la contrainte `schedule_audit_action_check` ne connaissait pas encore
  d'action pour cette écriture ; ajout de `'write_slots'` **en conservant**
  toutes les valeurs existantes (vérifié une à une contre les deux migrations
  qui touchent cette contrainte, `20260829105141` et `20260829114151` — j'ai
  d'abord oublié `'rollback'` en me basant sur la version d'origine, corrigé
  avant de committer).

## Ce qui n'a pas été touché

`approve.ts` n'exige toujours que « chaque page vérifiée », pas « chaque
page vérifiée a des créneaux écrits ». Une version peut donc encore être
approuvée puis activée sans qu'aucun créneau existe pour une classe. Ce
n'était pas dans le périmètre du LOT 1 (« transformer les pages vérifiées en
lignes de `schedule_slots` », pas « garantir que l'admin le fasse toujours
») — mais c'est un choix à trancher explicitement avant l'usage réel :
soit on ajoute cette exigence à `approve.ts` (LOT 3, rapport lisible par un
humain, semble le bon endroit), soit on assume qu'une classe sans créneaux
écrits est un état valide (professeur sans cours ce jour-là, par exemple).
Aucune route front n'appelle encore `slots.ts` : l'écran `ScheduleImportPage`
n'a pas été modifié.

## Recette PostgreSQL locale réelle

`npm run recipe:local-schedule-slot-write-point` — établissement, personnel
et emploi du temps entièrement fictifs, cible `127.0.0.1:54322` codée en dur,
jamais d'URL distante, jamais `--linked`.

Le Postgres local tournait déjà (utilisé par d'autres lots en cours en
parallèle cette nuit) : plutôt que `supabase db reset` — qui aurait effacé
la base partagée et cassé les sessions concurrentes — la migration a été
appliquée directement (SQL additif, sans perte de données) puis enregistrée
dans `supabase_migrations.schema_migrations` pour rester cohérente avec un
futur `db reset`.

Preuves obtenues (14 assertions, transaction annulée à la fin, aucune trace
laissée — vérifié par une connexion séparée après le rollback) :

1. Une page vérifiée + deux créneaux inventés → deux lignes réelles dans
   `schedule_slots`, portant la référence de classe de la page.
2. Un renvoi avec un contenu différent remplace : une seule ligne reste,
   c'est la nouvelle.
3. Une page non vérifiée est refusée (`409`), rien n'est écrit.
4. Une fois la version promue `approved` (en satisfaisant réellement le
   déclencheur `schedule_validate_source_promotion` : pages mappées + page
   assets déposés + contrôle technique complet — pas contourné), une
   nouvelle écriture est refusée (`409`, « n'est plus modifiable »).
5. **Un créneau appartient toujours à une version, jamais orphelin** : la
   vraie contrainte de la table (`schedule_slots_guard_source`) refuse même
   la suppression de la version tant qu'elle porte des créneaux — plus fort
   qu'un simple `on delete cascade` silencieux. Vérifié en tentant la
   suppression (rejetée) plutôt qu'en supposant son comportement.

## Découvertes en cours de route (corrigées avant de committer)

- Contraintes réelles de `schedule_slots` différentes de ce qu'une lecture
  rapide du schéma Drizzle laissait supposer : `subject_code` limité à 32
  caractères (pas 80), `subject_label` à 120 (pas 160), `review_status`
  vaut `'pending' | 'approved' | 'rejected'` (pas `'verified'`) — le
  validateur et le point d'écriture ont été corrigés pour correspondre à
  `supabase/migrations/20260830024727_create_private_schedule_slots.sql`,
  pas à une supposition.
- Promotion d'une version vers `approved` : exige en réalité, en plus des
  pages vérifiées, un `schedule_page_assets` par page (déclencheur
  `schedule_guard_page_asset_write`, qui n'accepte l'écriture que pendant
  `status = 'processing'`) et `pageAssetsVerified: true` dans
  `validation_summary`. La recette respecte cette séquence réelle
  (`processing` → dépôt des pages → `review`) plutôt que de la contourner.

## Vérifications avant commit

- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- `npx vite build` : succès.
- `npm run test:migration-integrity` : 109 migrations, versions uniques.
- `npm run test:spec-integrity` : OK.
- `npm run test:preview-security-gate` : succès complet (code 0), inclut
  `test:schedule-request-body-bounds` (mis à jour avec la nouvelle route),
  `test:schedule-admin-payload`, `test:schedule-promotion-input`,
  `test:schedule-page-assets`, `test:schedule-import-security`.
- `npm run test:schedule-slot-input` et
  `npm run recipe:local-schedule-slot-write-point` : détaillés ci-dessus.

## Statut

LOT 1 terminé et prouvé en local. Reste ouvert pour un lot ultérieur : décider
si `approve.ts` doit exiger des créneaux écrits par page, et brancher l'écran
d'administration sur `slots.ts` (aucun des deux n'était dans le périmètre du
LOT 1).
