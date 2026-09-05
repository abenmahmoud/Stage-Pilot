# LOT 5 — Clôture du plan « une correction se publie »

5 septembre 2026. Plan : `docs/operations/PLAN_FLASH_CORRECTION_VISIBLE_2026-09-05.md`,
LOT 5 uniquement, conformément à la demande (« Exécute UNIQUEMENT le LOT 5 »).
Ce lot ne code rien : compte rendu global, relecture des quatre journaux
précédents (`CORR-LOT1.md` à `CORR-LOT4.md`), et vérification que rien n'a
changé depuis le dernier commit (`git status` propre hors `.nuit.lock`,
fichier hors périmètre de ce dépôt applicatif, non touché). Aucune migration,
aucun drapeau, aucun envoi, aucune donnée réelle.

## Verdict : le plan n'est PAS terminé

Le plan promet, dans son propre énoncé (§ « La régression à réparer ») :
« une information ne disparaît jamais du site du fait d'une correction ».
`CORR-LOT4.md` a prouvé, contre PostgreSQL réel et en navigateur Chromium
réel, que c'est **faux aujourd'hui** : corriger une information publiée la
fait disparaître de la route publique immédiatement, et aucun geste depuis
l'écran ne peut la republier. Ce lot 5 ne change pas ce verdict : je n'ai
touché à aucun des fichiers en cause, donc l'état décrit par `CORR-LOT4.md`
est toujours l'état réel du dépôt (vérifié par lecture directe, ce jour même :
`api/flash/proposals/[id]/publication.ts` ligne 145 et
`api/flash/validation/publishable.ts` ligne 66 filtrent toujours
exclusivement `status = 'validee'`).

## Ce que chaque lot a réellement livré, et sur quelle preuve

| Lot | Livré | Nature de la preuve |
|---|---|---|
| 1 | `modifiee -> publiee` légale dans `shared/flash-transitions.ts` ; garde de visibilité `selectLatestVisibleFlashVersionPerInfo` (module pur, non branché sur aucune route) | Tests unitaires purs (25 tests), `tsc`, sécurité, spec-integrity. **Aucune base réelle, aucun navigateur.** |
| 2 | Écran de correction : rappel « pas visible, il faut publier », nom de l'ancienne version encore servie, bouton de republication branché sur `publish()` existant | Tests statiques sur le code source (14 tests), `tsc`, build. **Aucune base réelle, aucun navigateur.** Le lot signale lui-même, par lecture de code, que `publication.ts`/`publishable.ts` bloqueraient ce bouton en pratique. |
| 3a | Case « Visible par tous sur le site » sur l'écran de proposition, reliée à `FLASH_PUBLIC_AUDIENCE_GROUP_REF` | Test statique (10/10), `tsc`, build. Pas de clic réel en navigateur sur cette case précise (comblé partiellement au LOT 4 par le chemin serveur, jamais par le clic lui-même). |
| 3b (plafond de budget IA) | **Non fait.** Aucune des quatre variables (`OPENAI_BUDGET_GUARD_ENABLED`, `OPENAI_DAILY_BUDGET_EUR`, `OPENAI_SUPPORT_MAX_CALL_EUR`, `OPENAI_CONTENT_MAX_CALL_EUR`, `OPENAI_COMMUNICATION_MAX_CALL_EUR`) n'apparaît dans `.env.local.example` ; aucun journal `CORR-LOT*` ne mentionne `shared/agent-ai-budget.ts` ni `agent_ai_budget_days`. `CORR-LOT3.md` ne couvre que 3a. | — |
| 4 | Recette réelle PostgreSQL + navigateur (captures 320/390/1440) | Exécution réelle. A **trouvé et prouvé** que le parcours de correction casse la promesse du plan (deux échecs détaillés ci-dessous) et que le chemin « visible par tous » fonctionne de bout en bout côté serveur. |

Vérifié aujourd'hui, avant d'écrire cette clôture : `npm run
test:preview-security-gate` (intégralement vert, y compris les modules
flash), `npm run test:spec-integrity` (635 tâches, comptage inchangé),
`npm run build` (`vite build`, succès, `✓ built in 8.10s`). Ces trois
commandes ne rejouent aucune recette PostgreSQL ni navigateur : elles
confirment seulement que le dépôt est dans le même état stable que celui
laissé par `CORR-LOT4.md`, pas qu'un défaut a été corrigé.

## Ce qui manque avant que ce plan puisse être déclaré terminé

Repris tel quel de `CORR-LOT4.md`, toujours vrai à cette date, rien n'ayant
été codé depuis :

1. **Le trigger `flash_guard_version`**
   (`supabase/migrations/20260905013000_create_flash_info_foundation.sql`,
   lignes ~256-262) n'autorise que `(old.status = 'publiee' and new.status =
   'modifiee')`. Une migration doit ouvrir l'inverse
   (`old.status = 'modifiee' and new.status = 'publiee'`) pour que la base
   accepte réellement ce que `shared/flash-transitions.ts` autorise depuis le
   LOT 1.
2. **`api/flash/proposals/[id]/publication.ts`**, clause `WHERE` ligne 145 :
   n'accepte que `status = 'validee'`. Doit accepter aussi `'modifiee'`, sans
   quoi le bouton construit au LOT 2 échoue toujours avec un message de
   concurrence trompeur (déjà observé en base réelle au LOT 4).
3. **`api/flash/validation/publishable.ts`**, ligne 66 : même filtre exclusif
   sur `'validee'`. Sans correction, aucune file d'écran ne peut jamais
   présenter une correction en attente de republication.
4. **Une décision explicite d'Adel sur le mécanisme de persistance entre
   l'enregistrement d'une correction et sa republication.**
   `api/flash/proposals/[id]/correction.ts` mute aujourd'hui la même ligne en
   place (`flash_info_versions`) : titre et texte de l'ancienne version
   publiée sont écrasés dès l'enregistrement de la correction, avant toute
   republication. Il n'existe qu'une ligne par information
   (`flash_infos.current_version`). Deux options possibles, à trancher par
   Adel, pas par ce plan :
   - `correction.ts` crée une **seconde ligne de version** (nouveau
     `flash_info_versions`), pendant que la ligne `publiee` existante reste
     inchangée et servie jusqu'à la republication effective ;
   - une autre mécanique équivalente, mais le principe actuel — une seule
     ligne mutée en place — rend structurellement impossible la promesse du
     plan. Ce n'est pas un bug isolé à corriger dans un coin : c'est le choix
     de modélisation qui contredit l'énoncé même du plan.
5. **LOT 3b (plafond de budget IA)** reste entièrement à faire : aucune
   variable documentée, aucune vérification des trois opérations
   (`support_assistant`, `content_assist`, `communication_assist`), aucune
   preuve du refus au plafond atteint, aucune preuve du refus en
   configuration invalide. Le plan liste ce travail comme faisant partie du
   LOT 3 ; il n'a jamais été exécuté.

## Ce qui a été prouvé, sans réserve, et reste valable

- Un flux de publication simple (proposer, valider, publier, **sans**
  correction) ne casse rien et n'a jamais laissé la page publique vide
  (LOT 4, scénario C, PostgreSQL réel).
- Le chemin serveur complet de l'audience « visible par tous » fonctionne :
  proposition avec `public:site` → validation → publication → apparition
  réelle sur `GET /api/content/flash/public`, prouvé en base réelle et en
  navigateur (LOT 4, scénario D).
- La règle pure de visibilité et le graphe de transitions (LOT 1) sont
  corrects et testés exhaustivement en tant que modules, indépendamment du
  fait qu'ils ne sont pas encore branchés sur la persistance réelle.

## Ce qui reste supposé, pas prouvé

- Le clic réel, en navigateur, sur la case « Visible par tous sur le site »
  de `FlashProposalPage.tsx` (LOT 3a) : prouvé par test statique et par le
  chemin serveur qu'il produit, jamais par un clic Playwright littéral sur
  cette case.
- Le comportement du trigger `flash_guard_version` face à un
  `modifiee -> publiee` qui atteindrait réellement le `UPDATE` SQL : lu dans
  la migration, jamais déclenché, car la clause `WHERE` de `publication.ts`
  empêche aujourd'hui d'y arriver.
- Tout ce qui suppose qu'une correction se propage réellement jusqu'au public
  (changement d'audience notifié, écart décisif traité après republication) :
  non observable tant que republier une correction échoue.
- Le plafond de budget IA (LOT 3b) dans son ensemble : rien n'a été ni
  documenté, ni vérifié, ni prouvé.

## À trancher avec Adel avant tout nouveau lot sur ce plan

1. **Le choix de modélisation de la persistance** (point 4 ci-dessus) : une
   seconde ligne de version, ou une autre mécanique. Sans cette décision,
   aucun correctif de `publication.ts`/`publishable.ts`/trigger ne peut être
   écrit sans figer un choix qui n'appartient pas à l'exécutant.
2. **Le périmètre réel de LOT 3b** : le crédit de 50 $ et le plafond
   quotidien sont des décisions déjà prises par Adel (5 septembre 2026,
   § LOT 3 du plan) mais jamais mises en œuvre. À confirmer si ce travail
   reste dû sous ce plan, ou doit être reporté à un plan dédié au budget IA.
3. **Si ce plan doit être déclaré « terminé » en l'état** (audience publique
   et rappel d'écran livrés, mais promesse centrale du plan — la correction
   qui remplace au lieu de disparaître — non tenue), ou s'il reste ouvert
   jusqu'à ce que les points 1 à 5 soient traités par un ou plusieurs lots
   supplémentaires. Ce compte rendu ne referme pas le plan de lui-même : il
   rapporte l'état réel pour qu'Adel tranche.

## Portée strictement respectée

Fichier touché, rien d'autre : ce journal
(`docs/operations/night-logs/CORR-LOT5.md`). Aucun code, aucune migration,
aucun drapeau, aucun composant, aucun test modifié. Aucune tâche Spec Kit
cochée ou ouverte (comptage vérifié inchangé : 635).
