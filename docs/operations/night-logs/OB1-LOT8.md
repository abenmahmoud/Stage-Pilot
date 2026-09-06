# LOT 8 — Clôture honnête

Plan : `docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, section « LOT 8 ».
Portée stricte : pas d'implémentation nouvelle, un bilan lot par lot de ce qui
est réellement prouvé, ce qui est simulé, ce qui reste à brancher — plus les
quatre vérifications finales demandées par le plan.

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

### LOT 7 — Tests adverses obligatoires : **NON prouvé, incomplet**

C'est le désaccord central de cette clôture avec l'hypothèse de départ de
la session (« tous les lots demandés sont passés »). État réel constaté :

- `scripts/test-knowledge-recall-adverse.mjs` existe (428 lignes) mais est
  **non suivi par git** (`git status` : `??`), donc **non commité** — aucun
  commit `feat(ob1): LOT 7` n'existe dans l'historique (dernier commit OB1 :
  `9b59631`, LOT 6).
- Il n'est **branché nulle part dans `package.json`** : aucune entrée
  `test:knowledge-recall-adverse` ni équivalente.
- Son propre en-tête référence deux artefacts qui **n'existent pas** dans le
  dépôt : `scripts/test-local-knowledge-recall-adversarial.mjs` (la recette
  PostgreSQL réelle promise pour les points 3, 5, 6, 9 de la liste du plan)
  et `docs/operations/night-logs/OB1-LOT7.md` (son propre compte-rendu).
- Exécuté directement pour vérifier son état réel
  (`node --import ./scripts/ts-test-resolver.mjs --experimental-strip-types
  scripts/test-knowledge-recall-adverse.mjs`) : **10/10 tests passent
  aujourd'hui**. Mais deux titres de test s'auto-qualifient de couverture
  incomplète : le point 7 (« couverture partielle, documentée ») et le
  point 9 (« idempotence … documenté », sans recette réelle).
- Aucune preuve sur PostgreSQL réel n'existe pour les points 3, 5, 6 et 9 du
  LOT 7 (brouillon Hebdo invisible, source contestée exclue, source hors
  audience exclue, absence de doublon), contrairement à l'exigence explicite
  du plan pour ce lot (« Recette sur PostgreSQL local réel pour ceux qui
  touchent la base »).

**Conclusion : le LOT 7 n'est pas terminé.** C'est une ébauche de tests purs,
non intégrée, non committée, qui documente elle-même ses propres lacunes. Il
ne doit pas être compté comme fait tant qu'il ne porte pas : (a) la recette
PostgreSQL réelle manquante pour les points 3/5/6/9, (b) une entrée
`package.json`, (c) un commit avec son night-log `OB1-LOT7.md`.

### LOT 8 — ce lot

Bilan ci-dessus, plus les quatre vérifications finales ci-dessous. Aucune
tâche de `tasks.md` ne référence ce plan (`provenance_status`, `use_policy`,
`knowledge_source_proposals`, « OB1 ») : vérifié par recherche sur les cinq
fichiers `specs/*/tasks.md`, zéro résultat. Il n'y a donc rien à cocher ni à
décocher pour ce plan.

## Preuves exécutées pour cette clôture (aujourd'hui, sur l'arbre réel)

- `node node_modules/typescript/bin/tsc --noEmit` : **0 erreur**.
- `npx vite build` : **succès** (avertissement standard, préexistant, sur des
  chunks > 500 kB — sans lien avec ce plan).
- `npm run test:preview-security-gate` : **exit 0**, suite complète verte
  (inclut entre autres `test:communication-webmail-client`,
  `test:migration-integrity` — 107 migrations, 107 versions uniques, 78
  références vérifiées).
- `npm run test:spec-integrity` : **exit 0** — `{"specs":5,"tasks":635,...}`,
  aucune anomalie.

## Ce qui est simulé / non revérifié à cette clôture

- Les recettes PostgreSQL locales des LOT 1 à 6 n'ont **pas** été rejouées
  pendant ce LOT 8 (le plan ne le demande pas à la clôture ; elles restent
  telles que documentées dans leurs night-logs respectifs — non revérifiées
  aujourd'hui, pas re-simulées).
- LOT 7 : voir ci-dessus, état réel = incomplet, pas seulement « non
  revérifié ».
- Aucun environnement distant (preview Vercel, Supabase distant) n'a été
  touché ni interrogé, conformément à l'interdiction du plan et de
  CLAUDE.md.

## Fichiers modifiés par ce lot

- `docs/operations/night-logs/OB1-LOT8.md` (nouveau, ce fichier).

Aucun autre fichier touché : ce lot est une clôture, pas une implémentation.
`nuit.ps1` (modifié) et `scripts/test-knowledge-recall-adverse.mjs` (non
suivi) restent tels quels dans l'arbre — préexistants à ce lot, pas les
miens, conformément à la règle de périmètre du plan (« n'écrase aucune
modification qui n'est pas de toi »).

## Migrations ajoutées par ce lot

Aucune.

## Limites restantes (cumulatives, tous lots confondus)

1. **LOT 7 à terminer réellement** (voir ci-dessus) — c'est le blocage
   principal avant de pouvoir dire que le plan complet est clos.
2. LOT 5 : défense en profondeur absente sur les payloads des nouvelles
   routes, auto-approbation possible, republication après correction non
   rejouée en recette, aucune interface d'administration pour la file,
   rétention de `knowledge_source_proposals` non tranchée.
3. LOT 6 : déclenchement « publication » non exercé par appel HTTP complet
   sur deux routes précises, exécution réelle du cron Vercel jamais
   observée, rétroactivité sur d'éventuelles sources déjà expirées avant ce
   lot non vérifiée en production.
4. Aucune des preuves LOT 1 à 6 n'est une recette distante : toutes sur pile
   Supabase locale jetable, conformément au plan — donc à rejouer avant
   toute mise en production réelle.

## Ordre recommandé pour la suite

1. Terminer réellement le LOT 7 : écrire la recette PostgreSQL réelle
   manquante pour les points 3/5/6/9, intégrer
   `scripts/test-knowledge-recall-adverse.mjs` à `package.json`, écrire
   `docs/operations/night-logs/OB1-LOT7.md`, commit dédié.
2. Rejouer alors cette clôture (LOT 8) avec un LOT 7 réellement terminé
   avant de considérer le plan de connaissance OB1 comme clos.
3. Trancher les angles morts signalés par le LOT 5 (rétention,
   auto-approbation, interface de la file).
4. Vérifier avec Adel si une base de production existante a subi le défaut
   de contrainte d'audit corrigé au LOT 6 (cron nocturne potentiellement
   inopérant avant ce correctif).
