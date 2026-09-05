# LOT 4 — Corriger après publication (persistance flash)

Plan : `docs/operations/PLAN_FLASH_PERSISTANCE_2026-09-05.md`, LOT 4.
Portée exacte du lot : calcul serveur des trois ensembles et du gap depuis
l'audience/la trace RÉELLES, enregistrement de la décision humaine de
correction. **Aucun envoi.**

## Trou amont signalé au LOT 3, non résolu par ce lot

Le compte rendu du LOT 3 (`PERSIST-LOT3.md`, section "Ce qui reste supposé")
signale explicitement qu'**aucune tâche des 9 lots du plan n'écrit la
transition `validee` -> `publiee`**, et demande de trancher ce point avec Adel
"avant d'attaquer le LOT 4". Cette session n'a reçu aucune instruction
supplémentaire d'Adel sur ce point ; le trou reste entier. Conséquence directe
et assumée : la route de ce lot suppose qu'une version `publiee` existe déjà
en base (peu importe comment elle y est arrivée) et corrige à partir de là.
Elle est correcte et testée pour ce périmètre précis, mais ne peut être
exercée de bout en bout tant qu'aucune route ne fait jamais passer une version
à `publiee`. **Ce n'est pas un défaut de ce lot, c'est le trou amont qui se
propage.**

## Ce qui est prouvé par une commande réellement exécutée

- `node node_modules/typescript/bin/tsc --noEmit` : aucune sortie, aucune
  erreur.
- `npm run build` : succès (`✓ built in 8.55s`), code 0. Comme au LOT 3,
  `vite build` a tourné sans problème dans ce shell malgré le piège noté dans
  `CLAUDE.md`.
- `npm run test:flash-correction` (nouveau) : 10/10 tests verts.
- `npm run test:flash-recette` (chaîne existante + le nouveau script) : toutes
  les suites vertes (`flash`, `flash-proposal-page`, `flash-validation-page`,
  `flash-recette-adverse`, `flash-validation-access`, `flash-access`,
  `flash-payload-policy`, `flash-proposal-input`, `flash-decision-input`,
  `flash-correction`), aucune régression.
- `npm run test:migration-integrity` : 98 migrations, 98 versions uniques,
  aucune anomalie — **aucune migration ajoutée par ce lot** (toutes les
  colonnes/tables nécessaires — `flash_correction_decisions`,
  `flash_notification_dispatches` — existaient déjà depuis la migration LOT 1).
- `npm run test:spec-integrity` : inchangé (627 tâches, 5 specs).
- `npm run test:preview-security-gate` : code de sortie 0, aucun `ℹ fail
  [1-9]`, aucun `not ok`/`✖`/`Error:` dans la sortie complète (balayage fait
  après coup sur le fichier de sortie, pas seulement sur la fin affichée).

**Aucune preuve SQL directe cette fois** (contrairement au LOT 3) : Docker
n'a pas été relancé pendant cette session, aucune commande contre une pile
Supabase locale n'a été exécutée. Tout ce qui suit sur le comportement de la
route est donc démontré au niveau des fonctions pures qu'elle appelle
réellement (mêmes imports, vérifiés par lecture du fichier source dans les
tests), pas par un rejeu SQL en direct comme au LOT 3. À corriger au LOT 7.

## Fichiers créés

- `api/flash/proposals/[id]/correction.ts` — `POST
  /api/flash/proposals/[id]/correction`. Corrige une version dont le statut
  courant est `publiee` (unique transition légale vers `modifiee`, vérifiée
  par `assertLegalFlashVersionTransition`, jamais réécrite ici). Calcule
  `analyzeFlashVersionGap` (décisif/forme, LOT 1) et
  `resolveFlashAudienceTreatment` (trois ensembles + canaux éligibles, LOT 1)
  à partir de :
  - l'audience réelle de la version publiée (`flash_info_audiences`) ;
  - la trace réelle des envois (`flash_notification_dispatches` filtrée sur
    `status = 'sent'`, jamais l'importance déclarée) ;
  - l'audience et l'importance proposées par le corps de la requête
    (`parseFlashProposalInput`, LOT 2, réutilisé tel quel).
  Écrit dans une seule transaction : `UPDATE ... WHERE status = 'publiee'`
  (même verrou `SELECT ... FOR UPDATE` + garde conditionnelle que
  `decision.ts` au LOT 3), remplacement de l'audience (`DELETE` + `INSERT`),
  une ligne `flash_correction_decisions` (voir "Décisions prises" ci-dessous),
  une ligne `flash_info_events` (`flash_info.corrected`, avant/après). Ne
  touche jamais `flash_notification_dispatches` en écriture — vérifié par un
  test qui lit le fichier source (voir plus bas).
- `scripts/test-flash-correction.mjs` — 10 tests. Ne teste pas la route
  contre une base (aucune pile disponible ce soir) : rejoue la composition
  réelle des fonctions pures importées par la route (mêmes fonctions, jamais
  une copie) et vérifie par lecture du fichier source que ces fonctions y sont
  bien appelées de cette façon (même méthode que
  `test-flash-recette-adverse.mjs` pour les écrans). Couvre en particulier le
  cas nommé par le plan : une version urgente réellement notifiée
  (`previousNotifiedChannels` non vide) reste `correctionPossible = true`
  même quand la nouvelle importance est `normale`.

## Fichiers modifiés

- `api/_shared/flash-response.ts` — ajoute `toFlashAudienceTreatmentPayload`,
  qui fait passer un `FlashAudienceTreatment` par
  `isValidFlashAudienceTreatmentPayload` (contrat déjà écrit au LOT 1, jusqu'ici
  jamais consommé par aucune route) avant de répondre, même motif que
  `toFlashVersionPayload`/`toFlashValidationAccessPayload`.
- `package.json` — ajoute `test:flash-correction`, l'ajoute à la chaîne
  `test:flash-recette`.

## Décisions prises dans ce lot (à confirmer avec Adel)

- **La correction mute la MÊME ligne de version, elle n'en crée pas une
  seconde.** Comme au LOT 3 pour "modifier-puis-valider" : le trigger
  `flash_guard_version` n'immobilise que `institution_id`/`flash_info_id`/
  `version`/`previous_version_id`/`proposed_by`/`created_at` — jamais
  `title`/`body_markdown`/`importance`/`channels`/`expires_at`. Créer une
  seconde ligne échouerait de toute façon : `flash_info_version_insert_guard`
  exige qu'une ligne insérée démarre toujours à `proposee`, jamais directement
  publiée. Les contraintes CHECK `status = 'modifiee' ⟺ superseded_at is not
  null` collent aussi à une lecture "cette ligne se marque elle-même comme
  corrigée", pas "une autre ligne l'a remplacée". C'est la lecture la plus
  contrainte-compatible, pas une confirmation d'Adel.
- **La décision de correction est enregistrée déjà `confirmee`, pas laissée
  `en_attente`.** La table `flash_correction_decisions` force `decision =
  'en_attente'` à l'insertion (garde de trigger) ; la route insère donc la
  ligne ainsi puis la fait passer immédiatement à `confirmee`
  (`decided_by`/`decided_at` renseignés) dans la même transaction — transition
  que le trigger de mise à jour autorise explicitement depuis `en_attente`.
  Choix assumé : l'acteur qui corrige a déjà l'autorisation de validation de
  cette information (`assertFlashValidationAccess`, même vérification qu'au
  LOT 3) et le contenu est déjà appliqué en base au moment où la route
  répond — laisser la décision `en_attente` aurait affiché un état "en
  attente" alors que la correction est déjà visible sur le site. Le schéma
  garde `initiated_by = 'human'`/`requested_by` distincts de `decided_by` :
  rien n'empêche qu'un futur lot sépare un jour "demander" de "confirmer" si
  Adel le souhaite ; ce lot ne construit pas cette séparation, faute de tâche
  qui la demande explicitement.
- **`initiated_by` vaut toujours `human`, jamais `agent`.** La contrainte CHECK
  `gap_kind = 'decisif' or initiated_by = 'human'` interdirait `agent` pour un
  écart `forme` ; comme cette route est toujours déclenchée par un acteur
  humain authentifié (jamais un job autonome), `human` est la seule valeur
  cohérente ici. La valeur `agent` reste ouverte en base pour un usage futur
  hors de ce lot (détection automatique en tâche de fond, non demandée par le
  plan).
- **Aucune vérification d'expiration.** `checkFlashProposalExpiration` (LOT 1)
  gouverne les propositions non encore décidées (`proposee`) ; une version déjà
  `publiee` n'est plus soumise à cette horloge. Pas de réécriture de cette
  règle, simplement absence de son usage ici — cohérent avec son domaine
  (§ voir `shared/flash-expiration.ts`).

## Ce qui reste supposé, pas prouvé

- **Le trou de publication signalé au LOT 3 reste entier** (voir section
  dédiée en tête de ce fichier) : sans route qui amène une version à
  `publiee`, cette route ne peut jamais être atteinte en pratique aujourd'hui.
- **Aucune preuve SQL directe** (pas de pile Supabase locale relancée ce
  soir) : contrairement au LOT 3, rien ne confirme ici, contre une vraie base,
  que le verrou de concurrence (`UPDATE ... WHERE status = 'publiee'` rejoué
  sur une ligne déjà `modifiee` renvoie bien `UPDATE 0`), que le trigger
  accepte réellement l'écriture combinée contenu+statut+`superseded_at`, ou
  que l'insertion `flash_correction_decisions` puis sa mise à jour immédiate
  vers `confirmee` passent bien les triggers dans le même ordre que prévu.
  Tout cela est déduit de la lecture des contraintes SQL (migration LOT 1),
  pas rejoué. **À prouver au LOT 7.**
- Les deux choix de conception ci-dessus (mutation en place, confirmation
  immédiate) ne sont pas confirmés par Adel — comme au LOT 3 pour "modifier",
  c'est la lecture la plus compatible avec les contraintes déjà en base, pas
  une décision produit validée.
- Aucun test de bout en bout via une vraie requête HTTP (serveur Vercel dev ou
  équivalent) : même réserve qu'aux LOT 1/2/3 pour `requireFlashActor`/
  `requireUser` avec un vrai jeton Supabase.
- RLS, cloisonnement inter-établissement et cas des deux enfants d'un même
  contact restent hors preuve de ce lot : réservés au LOT 7, comme aux lots
  précédents.
- `test:preview-security-gate` ne connaît toujours pas le domaine flash
  (choix du LOT 1, non révisé ici) : sa réussite ce soir prouve l'absence de
  régression ailleurs dans le dépôt, pas une couverture du domaine flash.

## Commit

Un commit local sur `codex/lycee-connect-prototype`, aucun push.
