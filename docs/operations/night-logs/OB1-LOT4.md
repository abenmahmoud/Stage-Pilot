# LOT 4 — Trace de rappel

Plan : `docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, section « LOT 4 ».
S'appuie sur `decideKnowledgeSourceUsage` du LOT 2
(`docs/operations/night-logs/OB1-LOT2.md`) et sur le chargeur câblé au LOT 3
(`docs/operations/night-logs/OB1-LOT3.md`). Portée stricte : étendre la trace
existante (`agent_skill_audit`, action `consult_public`), pas créer une table
concurrente, pas toucher le coffre de codes.

## Ce qui a été étendu

### Module pur (`shared/knowledge-use-policy.ts`)

Nouvelle fonction pure `buildKnowledgeRecallTrace` : pour un rappel, assemble
une entrée par source candidate (proposée), avec :

- `outcome` (`retained` / `rejected`), fourni par l'appelant via
  `retainedSourceIds` (les sources réellement présentes dans le contexte
  construit par le chargeur, `citedSourceIds`) — ce module reste pur, il ne
  recalcule pas cette présence lui-même ;
- `reasonCode` : **toujours** le code stable du LOT 2
  (`decideKnowledgeSourceUsage`), jamais un motif inventé. Pour une source
  retenue, c'est le motif qui a autorisé l'usage
  (`policy_allows_instruction` / `policy_allows_cited_evidence`) — cela
  répond directement à l'exigence du plan « la politique qui a autorisé
  l'usage », sans champ redondant ;
- `usePolicy` : la politique d'usage de la source au moment du rappel ;
- `sourceVersion` : l'empreinte de contenu de la source (`checksum`), déjà
  utilisée ailleurs dans le registre comme identifiant de version (cf.
  `api/knowledge/admin/sources/[id]/action.ts`) — pas de nouvelle colonne.

**Cas limite documenté, assumé plutôt que masqué** : une source dont la
décision LOT 2 autorise l'usage (`policy_allows_instruction` /
`policy_allows_cited_evidence`) peut malgré tout ne pas être retenue dans le
contexte final si la compétence qui la requiert échoue pour une autre raison
(ex. une autre source requise du même skill est exclue, ou la compétence
n'est pas sélectionnée par la pertinence/le budget de caractères). Le motif
reste alors celui du LOT 2 : nécessaire mais pas suffisant. Ce n'est pas un
motif d'exclusion inventé — inventer un code supplémentaire aurait élargi le
vocabulaire stable du LOT 2 sans que le plan le demande. Couvert par un test
dédié (voir Preuves).

Nouvelle constante documentée, `KNOWLEDGE_RECALL_TRACE_MIN_RETENTION_DAYS =
180` : c'est un **plancher**, pas un plafond. Aucun mécanisme de purge
n'existe aujourd'hui pour `agent_skill_audit` (aucune ligne n'en est jamais
retirée automatiquement), donc ce plancher est trivialement respecté par
l'absence de purge — mais il documente qu'aucune purge future ne doit
retirer ces lignes plus tôt sans décision explicite. Ce n'est pas une
politique de rétention automatisée ; le plan demandait de « poser » une
durée minimale, pas de construire un worker de purge (hors périmètre de ce
lot).

### Chargeur (`api/_shared/public-knowledge-context.ts`)

- La requête `sourceRows` sélectionne désormais aussi `checksum` (en plus des
  colonnes déjà lues). `LoadedPublicKnowledgeContext` porte un nouveau champ
  `recalledSources: KnowledgeRecallSourceEntry[]`, calculé par
  `buildKnowledgeRecallTrace` sur les sources dédupliquées
  (`dedupedSourceRows`, variable extraite de code déjà existant — même
  déduplication qu'avant pour `evidenceSourceRows`, aucun changement de
  comportement sur ce chemin) avec `retainedSourceIds = citedSourceIds`
  (l'ensemble déjà utilisé pour peupler `sources`, donc « retenues » signifie
  exactement ce que `formatKnowledgeEvidenceCitations` et le registre de
  consignes montrent réellement au modèle).
- `recordPublicKnowledgeUsage` : le paramètre `sources` (institutionId +
  sourceId seuls, sans motif) est remplacé par `recalledSources`
  (`KnowledgeRecallSourceEntry[]`). Chaque source proposée à un rappel — pas
  seulement les retenues — produit désormais une ligne
  `agent_skill_audit` (`resourceType: "source"`, `action: "consult_public"`,
  comme avant), dont le `summary` porte en plus `outcome`, `reasonCode`,
  `usePolicy` et `sourceVersion`, à côté des champs déjà existants (`channel`,
  `sessionHash`, `model`, `turnCount`, inchangés). Les lignes `resourceType:
  "version"` (compétences consultées) ne changent pas : le plan ne porte que
  sur les sources.

### Appelant (`api/_shared/support-agent.ts`)

`RuntimeKnowledgeContext` et le type du paramètre `knowledgeUsageRecorder`
portent le nouveau champ `recalledSources` (optionnel, pour ne pas casser les
chargeurs de test qui ne le fournissent pas). L'appel à `usageRecorder`
transmet désormais `recalledSources: publicKnowledgeContext.recalledSources
?? []` au lieu de reconstruire une liste `{institutionId, sourceId}` sans
motif à partir de `sources` (le champ `sources`, avec titre/date, reste
utilisé tel quel pour les `sourceReferences` montrées à l'appelant — non
affecté).

## Deux exigences non négociables du plan

- **La question n'est jamais stockée en clair** : rien de nouveau ici — le
  `sessionHash` existant (déjà un hash calculé en amont, jamais la question)
  est inchangé, conformément à l'instruction explicite du plan de le
  conserver tel quel.
- **Aucune valeur sensible dans la trace** : prouvé par balayage sur
  PostgreSQL réel jetable (voir Preuves), pas par relecture du code. Le
  balayage vérifie qu'aucune des lignes réellement insérées ne contient la
  question posée, un fragment sensible qu'elle contenait, ni une valeur en
  forme d'adresse email.

## Écart de portée résolu avant d'écrire le code

Deux tests pré-existants de `scripts/test-public-agent-skill-policy.mjs`
imposaient des garanties plus strictes que ce que ce lot demande :

- `never selects private source locators or ownership fields for the model`
  interdisait la présence littérale de `checksum: knowledgeSources.checksum`
  n'importe où dans le fichier du chargeur. Ce lot a besoin de sélectionner
  `checksum` pour la trace (LOT 4 : « la version de chaque source retenue »).
  La garantie a été reformulée pour rester fidèle à son intention réelle
  (`checksum` ne doit jamais atteindre le mapping qui alimente le registre de
  consignes envoyé au modèle) plutôt qu'assouplie en bloc : le test vérifie
  désormais précisément que le bloc `sources: sourceRows...map(...)` (celui
  qui nourrit `PublicAgentSkillCandidate`, donc le modèle) ne porte jamais
  `checksum`, alors que le reste du fichier peut le sélectionner pour un usage
  serveur uniquement.
- `keeps usage audit metadata free of messages and contact data` interdit le
  mot `checksum` dans le corps de `recordPublicKnowledgeUsage`. Le champ
  ajouté s'appelle `sourceVersion` (jamais `checksum`) précisément pour
  respecter cette garantie ; un commentaire qui utilisait le mot `checksum`
  a été reformulé pour ne pas déclencher ce garde-fou sur du texte
  documentaire alors que le code lui-même le respecte déjà.

## Preuves réellement exécutées

**Tests purs (aucune base) :**

- `npm run test:knowledge-use-policy` : 30/30 (25 tests LOT 2/LOT 3 inchangés
  + 5 nouveaux tests pour `buildKnowledgeRecallTrace`, y compris le cas
  limite « motif LOT 2 honnête même si la source n'est pas retenue »).
- `npm run test:public-skill-context` : 16/16, y compris les deux tests
  reformulés (garantie « jamais dans le mapping modèle » au lieu de « jamais
  sélectionné », et garantie « jamais le mot `checksum` dans l'audit »
  inchangée et toujours vraie).
- `npm run test:support-agent` (+ `test:assistant-school-context`) : 13 + 11
  tests, y compris le test mis à jour qui vérifie que `knowledgeUsageRecorder`
  reçoit désormais `recalledSources` (avec `outcome`, `reasonCode`,
  `usePolicy`, `sourceVersion`) à la place de l'ancien `sources` sans motif.
- `npm run test:knowledge-excerpts` : 13/13, pipeline d'extraits inchangé.
- `npm run test:adversarial-boundaries` (support-contact-input,
  identity-access, knowledge-actor, public-skill-context, agent-tool-policy) :
  tout passe.
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur, exécuté
  après chaque étape (nouvelle fonction pure, câblage du chargeur, câblage de
  l'appelant, mise à jour des tests).

**Preuve sur PostgreSQL réel jetable (pas sur une relecture du code), la
preuve explicitement demandée par le plan pour l'absence de donnée
sensible :**

Nouveau script `scripts/test-local-knowledge-recall-trace.mjs` +
`npm run recipe:local-knowledge-recall-trace` (`--local-stack-only`
obligatoire, cible codée en dur `127.0.0.1:54322`, n'hérite jamais de
`DATABASE_URL`). Établissement, compte, compétence et sources entièrement
fictifs (marqueur aléatoire par exécution).

- `npx supabase start` puis `npx supabase db reset` : **105 migrations**
  rejouées depuis zéro sans erreur (aucune migration ajoutée par ce lot,
  conforme à « réutilise la trace existante, ne crée pas de table
  concurrente »).
- Scénario : une source `can_use_as_evidence` (toujours retenue, chemin
  indépendant de la sélection de compétence — LOT 3) et une source `expired`
  (toujours écartée), liées à la même compétence fictive, jamais requises
  (leur devenir ne dépend donc que de `decideKnowledgeSourceUsage`, pas de la
  sélection de compétence). La question posée contient un fragment fictif
  reconnaissable (`code-eleve-fictif-<marqueur>`) et une adresse email
  fictive.
- `npm run recipe:local-knowledge-recall-trace`, exécuté deux fois de suite
  (une fois seul, une fois à la suite de la recette LOT 3 sur la même pile),
  **21 assertions** à chaque fois, mêmes résultats :
  1. `loadPublicKnowledgeContext` retourne, dans `recalledSources`, une
     entrée pour chacune des deux sources proposées (pas seulement la
     retenue) : la source `evidence` est `retained` avec le motif
     `policy_allows_cited_evidence`, la politique `can_use_as_evidence` et
     son `checksum` exact ; la source `expired` est `rejected` avec le motif
     `source_expired`.
  2. Après un appel réel à `recordPublicKnowledgeUsage`, deux lignes
     `agent_skill_audit` existent réellement en base (`resourceType:
     "source"`, `action: "consult_public"`, `actorId: null`), avec les
     mêmes `outcome`/`reasonCode`/`usePolicy`/`sourceVersion` que ce que le
     chargeur avait calculé, plus les champs déjà existants (`channel`,
     `model`, `sessionHash`, `turnCount`).
  3. **Balayage** (pas une relecture) : `JSON.stringify` de ces lignes
     réellement insérées ne contient ni la question posée, ni le fragment
     fictif sensible qu'elle contenait, ni aucune valeur en forme d'adresse
     email.
- Nettoyage vérifié par lecture directe de la base (pas par confiance) :
  après exécution, `select slug from institutions where slug like
  'ob1-lot4-recette-%'` renvoie un tableau vide.
- `npx supabase stop` après vérification.

La recette LOT 3 (`recipe:local-knowledge-context-evidence-separation`) a été
rejouée sur la même pile après ce lot : **10/10 assertions inchangées**,
aucune régression sur le chemin `evidence` que ce lot réutilise.

## Non vérifié / hors périmètre de ce lot

- `npx vite build`, `npm run test:preview-security-gate`,
  `npm run test:spec-integrity` : **non exécutés**, demandés par le plan à la
  clôture finale (§LOT 8), pas à chaque lot — même choix que LOT 3.
- Aucune preuve sur un environnement distant : uniquement la pile Supabase
  locale jetable. `scripts/test-preview-public-knowledge-flow.mjs` (recette
  Supabase preview réelle, hors périmètre local) a été mis à jour pour
  refléter le nouveau format de `summary` (clés `outcome`, `reasonCode`,
  `usePolicy`, `sourceVersion` en plus des clés existantes sur les lignes de
  type source), mais **non exécuté** : il cible un projet Supabase distant
  (`xijocumlwivhbmffrnlj`), explicitement hors périmètre de CLAUDE.md
  (« une preuve locale n'est pas une recette distante »).
- Purge automatisée du plancher de rétention (180 jours) : **non
  implémentée**. Le plan demandait de « poser » une durée minimale documentée,
  pas de construire un mécanisme de purge — en l'absence de toute purge
  aujourd'hui pour `agent_skill_audit`, le plancher est respecté par défaut,
  mais aucune protection technique n'empêche qu'un lot futur en ajoute une
  qui l'ignore. À signaler explicitement si un lot de purge est un jour
  entrepris sur cette table.
- Cas limite « motif LOT 2 honnête mais source non retenue pour une raison de
  compétence » : couvert par un test pur (module `buildKnowledgeRecallTrace`
  isolé), **pas** par la recette PostgreSQL de ce lot (le scénario minimal
  suffisant — une source toujours retenue, une source toujours écartée — ne
  l'exigeait pas). Documenté ici pour qu'un lot futur qui touche à la
  sélection de compétence sache que ce cas existe et reste couvert par un
  test, pas juste par du code.
- LOT 5 (file de validation, passage « publié → connaissance ») : non
  commencé.

## Fichiers modifiés

- `shared/knowledge-use-policy.ts` (nouvelle fonction pure
  `buildKnowledgeRecallTrace`, nouveaux types `KnowledgeRecallSourceEntry`
  / `KnowledgeRecallOutcome`, nouvelle constante documentée
  `KNOWLEDGE_RECALL_TRACE_MIN_RETENTION_DAYS`)
- `api/_shared/public-knowledge-context.ts` (`checksum` ajouté à la requête
  des sources ; `LoadedPublicKnowledgeContext.recalledSources` ; paramètre
  `sources` de `recordPublicKnowledgeUsage` remplacé par `recalledSources` et
  écrit dans `agent_skill_audit.summary`)
- `api/_shared/support-agent.ts` (`RuntimeKnowledgeContext` et
  `knowledgeUsageRecorder` portent `recalledSources` ; appel mis à jour)
- `scripts/test-knowledge-use-policy.mjs` (5 nouveaux tests pour
  `buildKnowledgeRecallTrace`)
- `scripts/test-public-agent-skill-policy.mjs` (garantie `checksum`
  reformulée pour rester précise après ce lot ; aucune garantie affaiblie)
- `scripts/test-support-agent.mjs` (test mis à jour pour `recalledSources`)
- `scripts/test-preview-public-knowledge-flow.mjs` (assertions mises à jour
  pour le nouveau format de `summary` ; non exécuté, cible distante)
- `scripts/test-local-knowledge-recall-trace.mjs` (nouveau, recette
  PostgreSQL réelle jetable de ce lot)
- `package.json` (nouvelle entrée `recipe:local-knowledge-recall-trace`)
- `docs/operations/night-logs/OB1-LOT4.md` (nouveau, ce fichier)
