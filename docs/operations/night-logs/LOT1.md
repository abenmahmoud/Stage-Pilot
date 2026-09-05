# LOT 1 — Modèle de données informations flash (5 septembre 2026)

Périmètre exécuté : uniquement le LOT 1 du plan
`docs/operations/NIGHT_PLAN_FLASH_2026-09-05.md`. Aucune ligne de LOT 2 à LOT 6
n'a été touchée. `src/pages/prototype/lycee-connect.css` non modifié.

## Sources lues avant d'écrire une ligne

- `specs/002-agent-etablissement-adaptatif/politique-operationnelle-agent-2026-2027.md`
  §13 (lu en entier, section ciblée par grep sur `## 13.`).
- `specs/002-agent-etablissement-adaptatif/tasks.md`, tâches T071, T071A,
  T071B, T071C, T071D (grep sur `T071`).
- `specs/project-memory.md` **non lu en entier**, conformément à la règle
  commune n°9 (pas eu besoin d'y recourir : le motif des tables `support_*` et
  `communication_*` s'est trouvé directement dans `supabase/migrations/` et
  `db/schema.ts`).
- Motif suivi à l'identique : `supabase/migrations/20260830053500_create_private_communications_foundation.sql`
  (fondation `communications`) et `20260901133000_create_communication_inbound_quarantine.sql`
  (guard functions, insert-guards, RLS forcée, revoke `anon`/`authenticated`,
  grants `service_role` uniquement).

## Ce qui a été livré

Un fichier de migration et son miroir Drizzle, rien d'autre :

- `supabase/migrations/20260905013000_create_flash_info_foundation.sql`
- Ajout en fin de `db/schema.ts` (après `communicationSourceEvents`), sans
  toucher aux tables existantes.

Six tables, toutes avec `institution_id`, RLS activée **et forcée**, aucun
privilège direct pour `anon` ni `authenticated`, seul `service_role` a des
droits explicites :

1. `flash_infos` — racine (une ligne par information flash). `status`
   draft/published/archived, `current_version`.
2. `flash_info_versions` — une ligne = une version **et** la proposition qui
   la porte. Contient texte, importance, canaux, expiration, auteur
   (`proposed_by`), valideur (`validated_by`/`validated_at`), dates de
   publication/remplacement. États couverts : `proposee`, `validee`,
   `publiee`, `modifiee`, `expiree_sans_validation`, `refusee` (les six exigés
   par le lot). Le lien vers l'ancienne valeur se fait par `previous_version_id`
   (chaînage), pas par duplication du contenu — décision documentée plus bas.
3. `flash_info_audiences` — photo de l'audience de chaque version (groupes
   ciblés), pour permettre à LOT 2 de calculer maintenus/retirés/ajoutés en
   comparant les audiences de deux versions.
4. `flash_notification_dispatches` — trace de ce qui a **réellement notifié**,
   par canal (push/email groupe, sms par contact choisi), avec un statut
   `sent`/`skipped`/`failed`. Seul `sent` compte comme notification réelle.
5. `flash_correction_decisions` — décision humaine sur une proposition de
   correction : nature de l'écart (`decisif`/`forme`), qui l'a demandée
   (`agent` seul sur `decisif`, `human` obligatoire sur `forme` — contrainte
   SQL), décision (`en_attente`/`confirmee`/`refusee`), effectifs des trois
   ensembles, canaux éligibles.
6. `flash_info_events` — journal d'audit append-only (déclencheur qui refuse
   toute modification/suppression), même motif que `communication_events`.

## Décisions de conception (à connaître pour LOT 2 à LOT 6)

- **« l'ancienne comme la nouvelle valeur »** (exigence du plan) est
  implémenté par chaînage (`previous_version_id`) et non par duplication des
  champs. Chaque version reste la source de vérité de son propre contenu ;
  comparer deux versions veut dire lire les deux lignes. Choix fait pour
  éviter la redondance (DRY) et rester cohérent avec `communication_versions`
  qui fonctionne pareil.
- **Contrainte « flash publiée sans expiration »** : `expires_at` est
  `NOT NULL` dès la création de la proposition (jamais nullable), donc aucune
  ligne, publiée ou non, ne peut exister sans expiration. Testé réellement
  (voir plus bas) : un `insert` sans `expires_at` échoue.
- **Canaux par importance** : contrainte SQL directe sur `channels` (jsonb)
  via les opérateurs de confinement `@>`/`<@` — normale = aucun canal,
  importante = push obligatoire + email facultatif, urgente = push et email
  obligatoires + sms facultatif. Le sms est toujours rattaché à un contact
  précis (`flash_notification_dispatches.contact_ref`), jamais à un groupe.
- **Transitions d'état légales** appliquées par un trigger côté base
  (`flash_guard_version`), en plus de ce que LOT 2 codera en TypeScript pur :
  double filet, pas un remplacement l'un de l'autre.
- **Correction de forme jamais automatique** : contrainte SQL
  `check (gap_kind = 'decisif' or initiated_by = 'human')` sur
  `flash_correction_decisions` — un agent ne peut pas insérer de ligne
  automatique sur un simple changement de forme, seul un humain le peut
  explicitement. Traduit en base l'exigence « correction de forme : rien par
  défaut ».
- Pas de table de « jobs »/file d'attente dans ce lot : non demandé par les
  exigences du LOT 1, et l'envoi réel reste hors périmètre de toute façon
  (interdiction absolue de tout envoi/notification réel).

## Preuves réellement exécutées

Toutes les commandes ci-dessous ont été lancées dans cette session, pas
supposées :

1. `npm run test:migration-integrity` → **succès**
   (`{"migrations":97,"uniqueVersions":97,...}`, exécuté deux fois, avant et
   après le rejeu réel décrit ci-dessous).
2. `node node_modules/typescript/bin/tsc --noEmit` → **succès**, aucune sortie
   d'erreur (le schéma Drizzle ajouté compile).
3. `npm run build` → **succès** (`tsc --noEmit && vite build`, build terminé
   en 18.92s, seul avertissement : chunks > 500kB, préexistant et sans rapport
   avec ce lot). Contrairement au piège connu documenté dans `CLAUDE.md`,
   `vite build` a fonctionné dans ce shell cette fois-ci (peut-être un
   environnement différent) ; à revérifier si un lot futur retombe sur
   l'échec habituel.
4. `npm run test:preview-security-gate` → **succès**, code de sortie 0, sur
   l'intégralité de la suite (```EXIT_CODE=0``` capturé explicitement).
5. **Rejeu réel de la migration sur pile Supabase locale jetable** : Docker
   Desktop était disponible cette nuit (`docker info` répond), et une pile
   Supabase locale pour ce projet tournait déjà
   (`supabase_db_lyceegest-prototype`, conteneurs `Up`/`healthy`). Commandes
   exécutées :
   - `npx supabase@2.116.0 migration list --local` → confirme que la nouvelle
     migration était bien en attente (`"remote":""`) et que les 96
     précédentes étaient déjà appliquées.
   - `npx supabase@2.116.0 migration up --local` → **`{"applied":[...20260905013000_create_flash_info_foundation.sql],"message":"Migrations applied"}`**.
     Le fichier SQL s'applique sans erreur sur un Postgres réel (syntaxe,
     contraintes, jsonb, triggers, tout valide).
   - Vérification structurelle par requêtes réelles : les 6 tables existent
     (`information_schema.tables`), RLS **activée et forcée** sur les 6
     (`pg_class.relrowsecurity`/`relforcerowsecurity` = true), et **aucune**
     ligne de `information_schema.role_table_grants` pour `anon` ou
     `authenticated` sur ces tables (seul `service_role` apparaît).
   - Vérification fonctionnelle par un bloc PL/pgSQL temporaire (données
     fictives, un email `@example.invalid`, tout `rollback`/supprimé ensuite,
     aucun nom réel) :
     - transition illégale `proposee → publiee` : **rejetée** (le test exige
       l'échec, sinon il lève une exception `REGRESSION`).
     - transition légale `validee → publiee` mais sans `published_at` :
       **rejetée** par la contrainte dédiée.
     - transition légale `validee → publiee` avec `published_at` renseigné :
       **acceptée**.
     - insertion d'une version sans `expires_at` : **rejetée**.
     - Nettoyage exécuté et vérifié : `select count(*) ...` après nettoyage
       renvoie `0` sur les trois tables/lignes fictives utilisées. Rien n'est
       resté dans la base.
   - Aucune donnée réelle utilisée (un seul utilisateur fictif, adresse
     `.invalid`, une seule institution déjà présente dans la pile locale de
     développement, réutilisée en lecture seule pour la clé étrangère).
   - Aucun `--linked`, aucun `db push`, aucune URL distante. Uniquement
     `--local`.

Aucune commande n'a échoué. Rien n'a donc dû être noté comme « échec
préexistant à masquer ».

## Ce qui reste supposé, pas prouvé

- La pertinence métier exacte des noms d'états et des seuils (ex. les 6 états
  de `flash_info_versions`, le découpage `decisif`/`forme` au niveau SQL) est
  une traduction de la lecture du §13 et des tâches T071*, pas validée par
  Adel ligne à ligne. LOT 2 (logique pure testée) est l'endroit où cette
  traduction sera exercée par des scénarios adverses concrets ; si un
  scénario du LOT 5 révèle un besoin de colonne ou de contrainte supplémentaire,
  ce lot devra être complété plutôt que contourné en TypeScript.
- Le comportement sous concurrence réelle (deux valideurs simultanés, par
  exemple) n'a pas été testé : seul un test séquentiel a été exécuté.
- Aucun test RLS positif/négatif avec un rôle `authenticated` réel connecté
  (uniquement vérification des `GRANT`/`REVOKE` et des drapeaux RLS) : la
  session locale utilisée pour les requêtes se connecte avec un rôle
  privilégié, pas un utilisateur applicatif simulé.

## Pour la suite (LOT 2 à LOT 6, à lire avant de coder)

- Les modules `shared/flash-*.ts` du LOT 2 doivent lire les deux versions
  (`previous_version_id`) plutôt que de s'attendre à un stockage dupliqué
  ancien/nouveau dans la même ligne.
- Le calcul maintenus/retirés/ajoutés se fait en comparant les lignes de
  `flash_info_audiences` de deux `version_id` différents (même `flash_info_id`).
- L'éligibilité d'une correction à un canal se lit dans
  `flash_notification_dispatches` filtré sur `status = 'sent'`, jamais sur
  l'importance déclarée de la version.
- La détection d'une proposition expirée sans validation peut s'appuyer sur
  l'index partiel `flash_info_versions_expiration_pending_idx`
  (`status = 'proposee'`, tri par `expires_at`).
