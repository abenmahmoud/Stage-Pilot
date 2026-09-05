# LOT 4 — Raccorder à la file durable existante

5 septembre 2026. Plan : `docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md`.
Session unique, LOT 4 seulement, à la suite du LOT 3 (écrire les envois sans
envoyer, compte rendu `PUBLIC-LOT3.md`).

## Ce que ce lot découvre, à confirmer avec Adel

Avant d'écrire une seule ligne, ce lot a relu en entier le schéma et les
migrations de la spec 005 (centre de communication) pour vérifier que la
« file durable existante » que le plan demande de réutiliser peut bien
porter les trois canaux de flash (push, email, sms). **Elle ne le peut pas,
aujourd'hui, et ce n'est pas une régression introduite ce soir** :

- `communication_deliveries.channel` porte un CHECK limité à `('email')`
  depuis sa création (migration `20260830053500`, jamais étendu depuis).
  Aucune ligne `push` ou `sms` n'y a jamais été possible.
- Aucun fournisseur, aucune table, aucun consommateur « push » n'existe nulle
  part dans ce dépôt. Ce n'est pas une omission de ce lot : ça n'a jamais été
  construit, pour aucun usage du centre de communication.
- `communications.source_type` était limité à
  `('direct_text', 'pdf', 'docx', 'image', 'forwarded_email')` — aucune
  origine « flash » n'était prévue. Étendu ce soir (voir migration).
- Le type de travail `prepare_delivery` existe dans le CHECK de
  `communication_jobs.job_type` depuis la fondation (`20260830053500`), mais
  **aucun code de ce dépôt ne le crée ni ne le consomme, nulle part, pour
  aucun usage** — même le parcours natif du centre de communication
  (`T010`, spec 005, tâche encore ouverte : « Construire le parcours
  Déposer, Vérifier, Publier et informer ») n'a jamais câblé cette étape.
  Le champ n'existe même pas pour porter un canal sur `communication_jobs` :
  seule `communication_deliveries` a une colonne `channel`.

**Décision prise ce soir, à confirmer** : plutôt que d'inventer, pour flash
seul, un second mécanisme de résolution de groupe et un premier consommateur
« push » qui n'existe pour personne d'autre dans ce dépôt (ce qui serait
exactement la « deuxième implémentation d'une même règle » que la règle
commune n°4 interdit), ce lot raccorde **seulement le canal email** du plan
d'envoi flash (`shared/flash-dispatch-plan.ts`) à la file durable existante,
et documente explicitement, dans le code et ici, que push et sms en restent
hors — ils continuent d'exister, inchangés, dans `flash_notification_dispatches`
(LOT 3). Étendre `communication_deliveries.channel` et bâtir un consommateur
push est un choix architectural plus large qu'un lot ne peut pas trancher
seul.

## Ce qui a été fait

- `supabase/migrations/20260905160000_add_flash_communication_bridge_source_type.sql` :
  étend le CHECK `communications.source_type` pour accepter `flash_info`,
  même convention que les migrations `20260905140000` et `20260905150000`
  (nom auto-généré `<table>_<colonne>_check`).
- `shared/flash-communication-bridge.ts` (nouveau, pur, sans base ni
  réseau) : `buildFlashCommunicationBridgeRequest({ flashInfoVersionId,
  title, bodyMarkdown, dispatchTargets })` filtre le plan d'envoi
  (`FlashDispatchTarget[]`) aux seules cibles `channel === "email"`, renvoie
  `null` si aucune (normale ; importante/urgente sans email choisi), sinon
  calcule une empreinte source déterministe (sha256 de l'identifiant de
  version), une empreinte de contenu et la liste triée et dédupliquée des
  `group_ref`.
- `api/_shared/flash-communication-bridge-persistence.ts` (nouveau) :
  - lit `communication_settings.module_enabled` **avant toute insertion** et
    renvoie `{ enqueued: false, reason: "module_disabled" }` sans rien
    écrire si le module est désactivé (défaut, aucun drapeau n'est ouvert
    par ce lot) — jamais un `try/catch` autour d'un `INSERT` : les triggers
    de garde (`communication_guard_job_flags`, migration `20260830160000`)
    lèveraient une exception SQL qui ferait échouer toute la transaction,
    y compris l'écriture LOT 3 déjà en place et la transition de la version
    flash elle-même ;
  - vérifie aussi la présence d'un secret d'idempotence
    (`FLASH_COMMUNICATION_BRIDGE_HMAC_SECRET`, ≥ 32 caractères) avant
    d'écrire quoi que ce soit ;
  - **vérifie l'existence de `communications` / `communication_versions`
    par une lecture verrouillée (`for update`) avant toute insertion,
    jamais par un `INSERT ... ON CONFLICT DO NOTHING` aveugle** sur ces deux
    tables précises. Raison, vérifiée par lecture de la migration
    `20260830080000` avant d'écrire ce fichier : `communication_root_insert_guard`
    et `communication_version_insert_guard` sont des triggers `BEFORE
    INSERT` qui exigent qu'une ligne naisse `draft` et, pour la version,
    que la racine soit encore `draft` au moment de l'insertion. Ces
    triggers s'exécutent avant la résolution d'un conflit d'unicité : sur
    une republication, retenter l'`INSERT` (même protégé par
    `onConflictDoNothing`) lèverait une exception dès que la racine est déjà
    `approved`, cassant toute la transaction. Aucune course n'est possible
    ici : l'appelant tient déjà un verrou `for update` sur la version flash
    source (`api/flash/proposals/[id]/publication.ts`), donc deux
    publications de la même version ne peuvent jamais s'exécuter en
    parallèle ;
  - à la première publication d'une version : insère `communications` et
    `communication_versions` à l'état `draft` (seul état accepté à
    l'insertion), puis les fait passer à `approved` par deux `UPDATE`
    distincts (autorisés par les triggers, qui ne protègent que
    l'immutabilité des champs de portée une fois approuvé) ;
  - insère les `communication_audiences` (`onConflictDoNothing`, sûr ici :
    le trigger de garde de cette table ne dépend d'aucun état préexistant) ;
  - met en file un travail `communication_jobs` de type `prepare_delivery`,
    état `pending`, clé d'idempotence HMAC-SHA256 dérivée de
    (établissement, communication, version) — `onConflictDoNothing`, sûr
    ici aussi : le trigger de garde des travaux ne vérifie que les
    drapeaux et l'état d'approbation, tous deux stables d'un appel à
    l'autre.
- `api/flash/proposals/[id]/publication.ts` : appelle le pont juste après
  l'écriture `flash_notification_dispatches` (LOT 3), dans la MÊME
  transaction, jamais dans la branche « déjà publiée ». Le résultat
  (`enqueued`/`reason`) est ajouté au résumé de l'événement
  `flash_info.published` déjà écrit, pour observabilité.
- Variable d'environnement `FLASH_COMMUNICATION_BRIDGE_HMAC_SECRET` (non
  définie ce soir, aucune valeur choisie ni committée) : tant qu'elle est
  absente, le pont reste inerte même si `module_enabled` devenait vrai un
  jour.
- Tests : `scripts/test-flash-communication-bridge.mjs` (nouveau, 17 cas) —
  9 cas sur la fonction pure réellement importée (normale → rien ; push
  seul → rien ; email → group_ref triés/dédupliqués ; sms exclu ; empreintes
  déterministes et distinctes ; libellé borné ; identifiant invalide
  refusé), 8 preuves de câblage par lecture de fichier source (imports
  réels, ordre d'appel après LOT 3 et après le retour anticipé « déjà
  publiée », secret lu depuis `process.env`, drapeau vérifié avant toute
  insertion, existence vérifiée par lecture verrouillée avant insertion sur
  `communications`, aucun appel réseau, type de travail littéralement
  `prepare_delivery`).
- `package.json` : script `test:flash-communication-bridge`, ajouté à
  l'agrégat `test:flash-recette`.

## Preuves réellement exécutées

- `npm run test:flash-communication-bridge` (nouveau) → 17/17.
- `npm run test:flash-recette` (agrégat complet, inclut désormais ce
  nouveau script) → intégralement vert.
- `npm run test:migration-integrity` → 102 migrations, versions uniques,
  77 références vérifiées, aucune orpheline.
- `npm run test:spec-integrity` → inchangé, vert (634 tâches, 5 specs).
- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npm run build` (`vite build`, a fonctionné dans ce shell ce soir) →
  succès, `dist/` produit.
- `npm run test:preview-security-gate` → code de sortie 0, aucun `fail`
  différent de 0 dans la sortie complète (fichier de sortie relu
  intégralement, pas seulement le code de sortie).
- `docker info` → échoue encore (`dockerDesktopLinuxEngine` introuvable),
  même constat que toutes les nuits précédentes de ce plan.

## Ce qui reste supposé, pas prouvé

- **Aucune preuve PostgreSQL réelle.** Docker Desktop reste indisponible
  dans ce shell ce soir. La migration `20260905160000` n'a jamais tourné :
  ni l'extension du CHECK `source_type`, ni la séquence complète
  `draft → approved` sur `communications`/`communication_versions` face
  aux vrais triggers (`communication_root_insert_guard`,
  `communication_version_insert_guard`,
  `communication_assert_current_version_consistency`,
  `communication_guard_job_flags`) n'ont été exécutées contre un
  PostgreSQL réel. Le raisonnement sur ces triggers vient d'une lecture
  attentive de leur code SQL, pas d'une exécution. C'est la limite la plus
  importante de ce lot : toute la séquence d'écriture de
  `api/_shared/flash-communication-bridge-persistence.ts` (la partie qui ne
  s'exécute que si `module_enabled` est un jour vrai) n'a jamais tourné une
  seule fois en base.
- **Le pont reste inerte dans tous les environnements existants** : par
  construction, tant que `communication_settings.module_enabled` est faux
  (défaut partout, aucun drapeau ouvert par ce lot) ou que
  `FLASH_COMMUNICATION_BRIDGE_HMAC_SECRET` n'est pas configuré, aucune
  ligne n'est écrite dans `communications` / `communication_versions` /
  `communication_audiences` / `communication_jobs`. C'est voulu, pas une
  limite accidentelle — mais ça veut dire qu'aucune publication flash,
  même en preview, n'a aujourd'hui de trace observable dans ces tables.
- **Aucun consommateur ne lira jamais ces travaux `prepare_delivery`
  aujourd'hui.** Confirmé par lecture de tout le dépôt : rien ne réclame
  (`claim`) ce type de travail, nulle part, pour aucun usage du centre de
  communication — ni pour flash, ni pour l'usage natif de la spec 005
  (`T010`, encore ouverte). La mise en file est réelle et prouvable au
  niveau des données ; le traitement de cette file (résolution de groupe en
  adresses réelles par le Webmail, § du plan) reste un travail futur non
  commencé, plus grand qu'un lot.
- **Aucune rétroaction vers `flash_notification_dispatches.status`.** Le
  commentaire laissé par le LOT 3 sur la colonne `status`
  (« skipped/failed = issus du traitement de la file (LOT 4) ») décrit un
  comportement qui suppose ce consommateur : tant qu'il n'existe pas, aucune
  ligne flash ne passera jamais à `skipped` ou `failed` par ce mécanisme.
  Ce lot ne le prétend pas.
- **Les cibles push et sms d'une publication flash ne sont raccordées à
  aucune file durable.** Elles restent, exactement comme après le LOT 3,
  visibles uniquement dans `flash_notification_dispatches` au statut
  `simulated`. Étendre le CHECK de canal de `communication_deliveries` et
  construire un consommateur push est un choix explicitement laissé ouvert
  à trancher avec Adel, pas tranché unilatéralement ce soir.
- **Aucune preuve navigateur.** Ce lot ne touche à aucun écran ; rien à
  ouvrir dans un navigateur.

## Portée strictement respectée

Rien d'autre que le LOT 4 n'a été touché : aucun changement à la porte de
l'écran de validation (LOT 5), aucune recette PostgreSQL ou navigateur
(LOT 6). Aucun drapeau ouvert (`communication_settings.module_enabled`
reste faux partout, `FLASH_COMMUNICATION_BRIDGE_HMAC_SECRET` non défini),
aucun envoi réel, aucune donnée réelle, aucun `git push`.
