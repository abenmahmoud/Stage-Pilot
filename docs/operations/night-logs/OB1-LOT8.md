# LOT 8 — Clôture honnête (rejouée)

Plan : `docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, section « LOT 8 ».
Portée stricte : pas d'implémentation nouvelle, un bilan lot par lot de ce qui
est réellement prouvé, ce qui est simulé, ce qui reste à brancher — plus les
quatre vérifications finales demandées par le plan.

## Pourquoi ce lot est rejoué

Une première clôture existe déjà dans l'historique (`5316fc3`, ce même
fichier). Elle a été écrite **avant** que le LOT 7 soit réellement terminé et
concluait, à raison pour ce moment-là : « le LOT 7 n'est pas prouvé ». Depuis,
le commit `b6405e5` (« feat(ob1): LOT 7 - tests adverses obligatoires et
correction de l'idempotence des propositions de connaissance ») a repris
exactement les points listés comme manquants et les a fermés dans **une seule
session**, sans délégation à un agent en arrière-plan, comme l'exigeait la
note d'état du plan. Cette session-ci vérifie cette fermeture sur l'arbre réel
(pas sur la parole du night-log précédent) et rejoue les quatre contrôles de
clôture. Aucune nouvelle ligne de code métier n'est ajoutée par ce lot.

## État réel, lot par lot

### LOT 1 — Migration additive et reversible : **prouvé**

`docs/operations/night-logs/OB1-LOT1.md`. Migration
`20260906010000_add_knowledge_source_provenance.sql` appliquée sur pile
Supabase locale jetable (`supabase db reset` complet), 13 combinaisons
interdites testées et rejetées nommément, `information_schema` relu pour
confirmer qu'`anon`/`authenticated` n'ont gagné aucun droit. Non rejoué
pendant ce LOT 8 (le plan ne le demande pas à la clôture) ; le night-log
reste la preuve de référence.

### LOT 2 — Module pur de politique d'usage : **prouvé**

`docs/operations/night-logs/OB1-LOT2.md`. `shared/knowledge-use-policy.ts`,
23 tests purs, `tsc --noEmit` propre, aucune régression sur
`public-skill-context` après extension de `public-agent-skill-policy.ts`.

### LOT 3 — Brancher le filtre serveur : **prouvé**

`docs/operations/night-logs/OB1-LOT3.md`. Câblage réel de
`sourceIsAuthorizedAndCurrent` et du chargeur de contexte, démontré sur
PostgreSQL local jetable : une source basculée en `can_use_as_evidence` en
base sort réellement du registre de consignes et apparaît dans le bloc de
citations séparé, vérifié sur le contexte reconstruit (pas sur le code).

### LOT 4 — Trace de rappel : **prouvé**

`docs/operations/night-logs/OB1-LOT4.md`. `buildKnowledgeRecallTrace`,
recette PostgreSQL réelle avec balayage (`JSON.stringify`) des lignes
d'audit insérées pour confirmer l'absence de question en clair et de valeur
sensible. Cas limite (source autorisée mais non retenue) documenté et
couvert par un test pur dédié.

### LOT 5 — File de validation et passage « publié → connaissance » : **prouvé, avec limites documentées**

`docs/operations/night-logs/OB1-LOT5.md`. Recette HTTP réelle de bout en
bout (28 assertions, sessions `aal2` réellement enrôlées en TOTP local),
les cinq puces du plan démontrées contre PostgreSQL réel. Limites
explicitement non résolues par ce lot : pas de défense en profondeur sur
les payloads des nouvelles routes, auto-approbation possible, republication
après correction non rejouée en recette, aucune interface d'administration
pour la file, rétention de `knowledge_source_proposals` non tranchée.

### LOT 6 — Heure de Paris et contrôles de fraîcheur : **prouvé, avec limites documentées**

`docs/operations/night-logs/OB1-LOT6.md`. Défaut latent trouvé et corrigé
en exécutant la recette (contrainte `agent_skill_audit_action_check`
manquante, qui aurait rendu le cron nocturne inopérant). `test:migration-
integrity`, `test:spec-integrity`, `npx vite build` et
`test:preview-security-gate` déjà exécutés avec succès par ce lot. Limites :
le déclenchement « publication » sur `sources/[id]/action.ts` et
`versions/[id]/action.ts` n'a pas été exercé par un appel HTTP complet
(seulement via la fonction partagée) ; l'exécution réelle du cron Vercel
n'a jamais été observée (interdit par CLAUDE.md) ; rétroactivité sur des
sources déjà expirées avant ce lot non vérifiée.

### LOT 7 — Tests adverses obligatoires : **prouvé, vérifié à nouveau dans cette session**

Repris à partir de la clôture précédente, qui le déclarait incomplet. Vérifié
directement sur l'arbre réel, pas sur la seule parole d'`OB1-LOT7.md` :

- Commit dédié présent dans l'historique : `b6405e5` (« feat(ob1): LOT 7 -
  tests adverses obligatoires et correction de l'idempotence des propositions
  de connaissance »), avec `docs/operations/night-logs/OB1-LOT7.md` inclus
  dans le même commit (`git show --stat b6405e5` : 8 fichiers, dont
  `scripts/test-knowledge-recall-adverse.mjs`,
  `scripts/test-local-knowledge-recall-adversarial.mjs`,
  `supabase/migrations/20260906040000_add_knowledge_source_proposal_conversation_idempotency.sql`).
- `package.json` porte bien les deux entrées manquantes à la clôture
  précédente : `test:knowledge-recall-adverse` et
  `recipe:local-knowledge-recall-adversarial` (vérifié par lecture directe du
  fichier dans cette session).
- `npm run test:knowledge-recall-adverse` rejoué dans cette session :
  **10/10 tests purs passent**, y compris le test 9 mis à jour (« idempotence
  … garantie pour `flash_publication` ET pour une conversation, corrigé au
  LOT 7 ») et le test 7, qui reste honnêtement étiqueté « couverture
  partielle, documentée » — limite assumée, pas un oubli.
- La recette PostgreSQL réelle promise par la note d'état (points 3, 5, 6, 9)
  existe : `scripts/test-local-knowledge-recall-adversarial.mjs` (475 lignes),
  décrite dans `OB1-LOT7.md` comme rejouée avec 20 assertions, `outcome:
  "pass"`, sur pile Supabase locale jetable. **Non rejouée une seconde fois
  dans cette session de clôture** (le plan ne le redemande pas au LOT 8, et
  la pile Supabase locale jetable n'a pas été redémarrée pour cette seule
  vérification) — la preuve de référence reste `OB1-LOT7.md`, pas cette
  clôture.
- Le manque fonctionnel réel signalé par le point 9 (idempotence absente pour
  une proposition issue d'une conversation) a bien une correction traçable
  dans le diff du commit : nouvelle migration, colonne
  `idempotency_key_hash` sur `knowledge_source_proposals`, route
  `api/knowledge/admin/proposals/index.ts` modifiée pour utiliser
  `onConflictDoNothing` + relecture, dans la même famille que le motif déjà
  utilisé pour `flash_infos`.

**Conclusion : le LOT 7 est maintenant réellement terminé**, sur la base de
preuves vérifiables dans l'arbre (commit, fichiers, exécution rejouée), pas
seulement sur la déclaration de son propre night-log.

### LOT 8 — ce lot

Bilan ci-dessus, plus les quatre vérifications finales ci-dessous. Aucune
tâche de `tasks.md` ne référence ce plan (`provenance_status`, `use_policy`,
`knowledge_source_proposals`, « OB1 ») : revérifié par recherche sur les cinq
fichiers `specs/*/tasks.md` dans cette session, zéro résultat, identique à la
clôture précédente. Il n'y a donc rien à cocher ni à décocher pour ce plan.

## Preuves exécutées pour cette clôture (aujourd'hui, sur l'arbre réel)

- `npm run test:knowledge-recall-adverse` : **10/10 tests purs passent**
  (rejoué dans cette session, voir ci-dessus).
- `node node_modules/typescript/bin/tsc --noEmit` : **0 erreur**.
- `npx vite build` : **succès** (`✓ built in 15.69s`, avertissement standard,
  préexistant, sur des chunks > 500 kB — sans lien avec ce plan).
- `npm run test:preview-security-gate` : **exit 0**, suite complète verte
  (inclut entre autres `test:communication-webmail-client`,
  `test:migration-integrity` — 108 migrations, 108 versions uniques, 79
  références vérifiées).
- `npm run test:spec-integrity` : **exit 0** —
  `{"specs":5,"tasks":635,"summary":[...]}`, identique en structure à la
  clôture précédente, aucune anomalie.

## Ce qui est simulé / non revérifié à cette clôture

- Les recettes PostgreSQL locales des LOT 1 à 7 n'ont **pas** été rejouées
  pendant ce LOT 8 (le plan ne le demande pas à la clôture) ; elles restent
  telles que documentées dans leurs night-logs respectifs — non revérifiées
  aujourd'hui, pas re-simulées. Seul le test **pur** du LOT 7
  (`test:knowledge-recall-adverse`) a été rejoué, parce qu'il ne dépend
  d'aucune base et coûte quelques millisecondes.
- Aucun environnement distant (preview Vercel, Supabase distant) n'a été
  touché ni interrogé, conformément à l'interdiction du plan et de
  CLAUDE.md.
- Le point 7 du LOT 7 (garde-fou déterministe pour les questions
  informationnelles générales sans source) reste à couverture partielle,
  assumé et documenté par son propre fichier de test — pas comblé par ce
  lot, qui n'est pas un lot d'implémentation.

## Fichiers modifiés par ce lot

- `docs/operations/night-logs/OB1-LOT8.md` (réécrit, ce fichier).

Aucun autre fichier de production ou de test touché : ce lot est une clôture,
pas une implémentation. `nuit.ps1` (modifié), `.nuit-coffre.lock`,
`.nuit.lock`, `docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md` et
`nuit-coffre.ps1` restent tels quels dans l'arbre — préexistants à ce lot,
hors périmètre du plan de connaissance OB1, conformément à la règle de
périmètre du plan (« n'écrase aucune modification qui n'est pas de toi »).
La modification non commitée de
`docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md` (ajout de la note
d'état du LOT 7 au 6 septembre 01 h 20, déjà présente avant cette session)
n'est pas non plus de ce lot ; elle est laissée telle quelle.

## Migrations ajoutées par ce lot

Aucune.

## Limites restantes (cumulatives, tous lots confondus)

1. LOT 5 : défense en profondeur absente sur les payloads des nouvelles
   routes, auto-approbation possible, republication après correction non
   rejouée en recette, aucune interface d'administration pour la file,
   rétention de `knowledge_source_proposals` non tranchée.
2. LOT 6 : déclenchement « publication » non exercé par appel HTTP complet
   sur deux routes précises, exécution réelle du cron Vercel jamais
   observée, rétroactivité sur d'éventuelles sources déjà expirées avant ce
   lot non vérifiée en production.
3. LOT 7 : point 7 (garde-fou déterministe généralisé pour les questions
   informationnelles générales sans source) à couverture partielle assumée ;
   l'idempotence du point 9 protège le rejeu d'un même envoi
   (`Idempotency-Key`), pas la déduplication de contenu identique soumis
   délibérément deux fois sous deux enveloppes différentes.
4. Aucune des preuves LOT 1 à 7 n'est une recette distante : toutes sur pile
   Supabase locale jetable, conformément au plan — donc à rejouer avant
   toute mise en production réelle.
5. La recette PostgreSQL réelle du LOT 7
   (`scripts/test-local-knowledge-recall-adversarial.mjs`) n'a pas été
   rejouée par cette clôture elle-même ; sa preuve de référence reste le
   night-log `OB1-LOT7.md`, pas ce document.

## Ordre recommandé pour la suite

1. Le plan de connaissance OB1 (LOT 1 à 8) peut être considéré comme clos
   sur la base des preuves listées ci-dessus et de leurs night-logs
   respectifs.
2. Trancher les angles morts signalés par le LOT 5 (rétention,
   auto-approbation, interface de la file) avant toute mise en production.
3. Décider si le point 7 du LOT 7 (garde-fou déterministe généralisé)
   mérite un lot dédié, et avec quelle portée exacte.
4. Vérifier avec Adel si une base de production existante a subi le défaut
   de contrainte d'audit corrigé au LOT 6 (cron nocturne potentiellement
   inopérant avant ce correctif).
5. Rejouer les recettes PostgreSQL locales des LOT 1 à 7 avant toute
   décision de mise en production, puisqu'aucune n'est une recette distante.
