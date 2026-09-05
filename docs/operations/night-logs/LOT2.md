# LOT 2 — Logique pure, testée, informations flash (5 septembre 2026)

Périmètre exécuté : uniquement le LOT 2 du plan
`docs/operations/NIGHT_PLAN_FLASH_2026-09-05.md`. Aucune ligne de LOT 1, 3, 4,
5 ou 6 touchée. `src/pages/prototype/lycee-connect.css` non modifié (vérifié
par `git status` avant et après : absent des fichiers changés). `.nuit.lock`
préexistant, laissé tel quel.

## Sources lues avant d'écrire une ligne

- `specs/002-agent-etablissement-adaptatif/politique-operationnelle-agent-2026-2027.md`
  §13 (lu en entier via l'offset ciblé par `grep` sur `flash`, pas le fichier
  complet).
- `specs/002-agent-etablissement-adaptatif/tasks.md`, tâches T071, T071A,
  T071B, T071C, T071D (`grep` sur `T071`).
- `specs/project-memory.md` **non lu en entier**, conformément à la règle
  commune n°9 — pas eu besoin d'y recourir : tout le contexte nécessaire
  (schéma, contraintes SQL, décisions de conception) était déjà dans
  `docs/operations/night-logs/LOT1.md`, `db/schema.ts` et la migration du
  LOT 1.
- `docs/operations/night-logs/LOT1.md` en entier (c'est le compte rendu du lot
  précédent, pas `project-memory.md`).
- `supabase/migrations/20260905013000_create_flash_info_foundation.sql` en
  entier, pour rejouer exactement le même graphe de transitions et les mêmes
  contraintes côté TypeScript (double filet, pas un remplacement).
- Style suivi à l'identique : `shared/nominative-merge.ts`,
  `shared/nominative-send-mode.ts`, `shared/nominative-value-policy.ts`,
  `shared/nominative-batch.ts` et leurs tests dans `scripts/test-nominative-*.mjs`
  (classes d'erreur avec `reason`, validation de champs par `Set`, fonctions
  pures, sorties triées et déterministes).

## Ce qui a été livré

Quatre modules `shared/flash-*.ts`, sans base ni réseau, et quatre fichiers de
test `scripts/test-flash-*.mjs`, agrégés dans `npm run test:flash` :

1. **`shared/flash-transitions.ts`** — transitions d'état légales
   (`isLegalFlashVersionTransition`, `assertLegalFlashVersionTransition`,
   `isFlashVersionStatusTerminal`). Rejoue exactement le graphe du trigger
   `flash_guard_version()` du LOT 1 : `proposee → validee|refusee|expiree_sans_validation`,
   `validee → publiee`, `publiee → modifiee`. Rester sur le même état n'est
   pas une transition (refusé explicitement, avec une raison distincte d'un
   état inconnu).
2. **`shared/flash-version-diff.ts`** — écart décisif/forme entre deux
   versions (`analyzeFlashVersionGap`). Un changement d'importance est
   toujours décisif. Le texte (titre + corps) est normalisé (espaces,
   ponctuation, casse retirés) ; identique après normalisation → « forme »,
   différent → « décisif » par défaut.
3. **`shared/flash-audience-correction.ts`** — les trois ensembles
   (maintenus/retirés/ajoutés) et l'éligibilité des canaux
   (`resolveFlashAudienceTreatment`), à partir de l'audience des deux versions
   et des canaux ayant *réellement* notifié la version précédente (jamais son
   importance déclarée).
4. **`shared/flash-expiration.ts`** — détection d'une proposition expirée sans
   validation (`checkFlashProposalExpiration`, `selectExpiredFlashProposals`),
   limitée à la détection pure (pas de message à l'auteur, pas de comptage :
   voir "Hors périmètre assumé" plus bas).

## Décision de conception à signaler : le découpage décisif/forme est un parti pris assumé, pas une preuve

§13 définit « décisif » par une liste fermée de faits (date, heure, lieu,
annulation, public, importance) et « forme » comme une reformulation SANS
changement de sens. Le schéma du LOT 1 ne porte que `title`/`body_markdown`
en texte libre et `importance` en champ structuré — aucune colonne
date/heure/lieu/annulation séparée. Une fonction pure ne peut donc pas
vérifier un SENS, seulement un TEXTE.

Le choix retenu, documenté en commentaire dans
`shared/flash-version-diff.ts` : un texte identique après normalisation
(espaces, ponctuation, casse) est classé « forme » ; tout le reste — y
compris une reformulation réelle sans changement de sens qu'un humain
reconnaîtrait — est classé « décisif » par défaut. Le risque tenu est de
proposer une correction de trop (l'humain peut la refuser, §13 : « peut
demander une notification même sur une correction de forme, ou la refuser sur
un changement décisif »), jamais de laisser passer un changement de date ou
de lieu sans le signaler. **Ce n'est pas prouvé conforme à l'intention
métier ligne à ligne** : à valider avec Adel, en particulier le cas d'une
vraie reformulation longue (paraphrase) qui serait aujourd'hui classée
décisif par excès de prudence plutôt que forme.

## Décision de conception : généralisation du cas « normale → urgente »

§13 ne donne qu'un exemple explicite : « un passage de normale à importante
ou urgente place tout le public dans les ajoutés ». `resolveFlashAudienceTreatment`
généralise ce principe à partir de la trace réelle (cohérent avec la
documentation de LOT 1 sur `flash_notification_dispatches.status`) : si
`previousNotifiedChannels` est vide (personne n'a réellement été notifié pour
la version précédente, quelle qu'en soit la raison déclarée) ET que la
nouvelle version notifie (importance ≠ normale), alors tout le public de la
nouvelle version est traité comme « ajouté », pas comme une correction.
Le cas concret testé et couvert par le plan (`normale → urgente`) fonctionne
par construction, puisqu'une flash normale n'a jamais de canal réel. La
généralisation au-delà de ce cas précis (ex. tous les envois ont échoué côté
fournisseur) est une extrapolation logique, **pas un scénario du plan, pas
testé isolément** — à signaler si un lot futur en dépend.

## Hors périmètre assumé (à ne pas confondre avec « fait »)

- **Le message factuel à l'auteur d'une proposition expirée (T071D)** n'est
  pas composé ici : le plan LOT 2 demande la « détection », pas le texte du
  message. `checkFlashProposalExpiration` détecte ; la formulation du message
  et le comptage des échecs consultables relèvent de LOT 4/LOT 5.
- **Aucune notion de délai ou de nombre de valideurs** n'est implémentée :
  hors périmètre du LOT 2.
- **La distinction sémantique fine forme/décisif** (paraphrase réelle sans
  changement de sens) n'est pas simulée ; voir section précédente.

## Preuves réellement exécutées

Toutes les commandes ci-dessous ont été lancées dans cette session, pas
supposées :

1. `npm run test:flash` (agrégat des 4 nouveaux fichiers) → **succès**, 27
   tests, 0 échec :
   - `test:flash-transitions` : 6/6.
   - `test:flash-version-diff` : 7/7.
   - `test:flash-audience-correction` : 8/8.
   - `test:flash-expiration` : 6/6.
   Les neuf scénarios minimums du plan sont couverts : correction de forme
   seule, changement d'heure seul, audience réduite, audience élargie,
   audience remplacée entièrement, flash normale modifiée, passage
   normale → urgente, expiration sans validation, double modification
   successive.
2. `node node_modules/typescript/bin/tsc --noEmit` → **succès**, aucune sortie
   d'erreur (les 4 nouveaux modules compilent, aucune régression ailleurs).
3. `npm run build` (`tsc --noEmit && vite build`) → **succès**, build terminé
   en 9.13s. Seul avertissement : chunks > 500 kB, préexistant et documenté
   dans LOT 1, sans rapport avec ce lot.
4. `npm run test:preview-security-gate` → **succès**, code de sortie 0
   capturé explicitement (`REAL_EXIT_CODE=0`), suite complète exécutée
   jusqu'à `test:migration-integrity` inclus (`{"migrations":97,"uniqueVersions":97,...}`).
5. `git status --porcelain` avant de committer → confirme que seuls les
   fichiers de ce lot ont changé (`package.json` modifié pour ajouter les
   scripts `test:flash*`, 4 nouveaux `shared/flash-*.ts`, 4 nouveaux
   `scripts/test-flash-*.mjs`) ; `src/pages/prototype/lycee-connect.css`
   absent de la liste ; `.nuit.lock` présent avant ce lot, non touché.

Aucune commande n'a échoué. Rien à noter comme « échec préexistant à
masquer ».

## Ce qui reste supposé, pas prouvé

- La pertinence métier exacte du seuil décisif/forme (voir plus haut) n'est
  pas validée par Adel ligne à ligne — seulement cohérente avec une lecture
  prudente de §13.
- La généralisation « previousNotifiedChannels vide → tout en ajoutés » au-delà
  du cas normale→urgente n'est pas un scénario explicitement demandé.
- Aucun test d'intégration avec les données réelles du LOT 1 (les modules ne
  lisent aucune ligne de `flash_info_versions` ou `flash_notification_dispatches` :
  ce sont des fonctions pures qui attendent des valeurs déjà extraites par
  l'appelant de LOT 3/4).

## Pour la suite (LOT 3 à LOT 6, à lire avant de coder)

- LOT 3/4 doivent extraire `previousNotifiedChannels` de
  `flash_notification_dispatches` filtré sur `status = 'sent'`, dédupliqué par
  canal, avant d'appeler `resolveFlashAudienceTreatment` — jamais déduire les
  canaux de l'importance déclarée.
- LOT 4 doit composer le texte des trois ensembles et le message factuel de
  proposition expirée (T071D) ; LOT 2 ne fournit que la détection et le
  calcul des ensembles/canaux, pas le texte affiché.
- Si un scénario de LOT 5 révèle qu'une reformulation raisonnable est
  aujourd'hui classée à tort « décisive » par excès de prudence, ce lot
  (`shared/flash-version-diff.ts`) devra être ajusté avec Adel plutôt que
  contourné ailleurs.
