# LOT 5 — File de validation et passage « publié -> connaissance »

Plan : `docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, section « LOT 5 ».
S'appuie sur `provenance_status`/`use_policy` (LOT 1), `decideKnowledgeSourceUsage`
(LOT 2, `docs/operations/night-logs/OB1-LOT2.md`), le câblage serveur (LOT 3,
`OB1-LOT3.md`) et la trace de rappel (LOT 4, `OB1-LOT4.md`). Portée stricte du
plan : réutiliser l'administration existante, pas construire un second
back-office.

## Décision de conception, prise avant d'écrire le code

Le plan demande cinq garanties (bullets 1 à 5 du LOT 5). La cartographie OB1
(`CARTOGRAPHIE_OB1_2026-09-05.md`) interdit explicitement d'ajouter un
troisième circuit de validation concurrent de ceux qui existent déjà
(documents, versions de compétence). Deux circuits existants ont été
réutilisés à l'identique, jamais réécrits :

- **`api/knowledge/admin/documents/[id]/review.ts`** : le patron « proposition
  → décision humaine → source en base » est repris presque à l'identique
  (verrou consultatif `pg_advisory_xact_lock`, transaction unique, double
  écriture d'audit) pour la nouvelle table `knowledge_source_proposals`.
- **`api/knowledge/admin/sources/[id]/action.ts`** (revoke) : sa logique de
  révocation + désactivation des compétences dépendantes a été **extraite**
  dans `api/_shared/knowledge-source-revocation.ts` plutôt que dupliquée,
  pour être appelée aussi bien par une action humaine explicite que par la
  correction automatique d'une actualité (bullet 3). `action.ts` lui-même
  n'a pas changé de comportement (refactor pur, couvert par les tests
  existants, voir Preuves).

**Une seule table nouvelle** : `knowledge_source_proposals`. Elle joue, pour
une conversation ou une actualité publiée, exactement le rôle que
`knowledge_documents` joue déjà pour un document téléversé — nécessaire car
`knowledge_documents` exige en `NOT NULL` des colonnes de stockage de fichier
(bucket, chemin, MIME, taille) qui n'ont pas de sens pour un texte de
conversation ou une actualité déjà en base ; forcer ce moule aurait été plus
trompeur que d'ajouter une table dédiée.

**Deux décisions humaines, jamais plus, jamais moins**, conformément au plan :

- Décision A — « rendre utilisable par l'agent » (`api/flash/proposals/[id]/
  knowledge.ts`) ou soumission d'un texte de conversation
  (`api/knowledge/admin/proposals/index.ts` POST) : crée la proposition,
  n'active rien.
- Décision B — la seconde validation (`api/knowledge/admin/proposals/[id]/
  decision.ts`, action `approve`) : crée **directement** la source dans
  `knowledge_sources` avec `status: 'published'` (jamais `'draft'`). C'est
  cette décision, et elle seule, qui « rend utilisable » au sens du plan —
  pas de troisième étape par `sources/[id]/action.ts`.

**Découverte faite en exécutant la recette, pas supposée à l'avance** :
`requireRole` (`api/_shared/auth.ts`) exige déjà `aal2` pour **tout** appel
de `superadmin`/`administration`/`agent`/`proviseur` — donc pour
`requireSupportAgent`/`requireKnowledgeManager`, que l'option
`{ publish: true }` soit demandée ou non. Les deux décisions A et B exigent
donc aujourd'hui, dans ce dépôt, une session `aal2` réelle. Ce n'est pas une
distinction que ce lot introduit ou peut retirer ; le commentaire initial du
code affirmant que la décision A « n'exige pas aal2 » était une hypothèse de
conception erronée, corrigée dans le code et ici après l'avoir observée
échouer contre PostgreSQL réel (voir Preuves).

## Bullet 1 — proposition issue d'une discussion

`api/knowledge/admin/proposals/index.ts` (POST) accepte un texte déjà rédigé
par un responsable à partir d'une conversation réelle (`conversationId` de
traçabilité, `candidateText`). Aucune conversation n'est lue par ce lot :
personne n'a construit de pipeline d'extraction automatique depuis les
conversations du guichet, le plan ne le demandait pas non plus.

Détection des données personnelles/secrets :
`shared/knowledge-source-proposal-policy.ts::detectPersonalOrSecretSignals`
réutilise `detectForbiddenSupportSecret` (`shared/support-secret-policy.ts`,
déjà partagé, déjà utilisé par `shared/knowledge-registry-input.ts`) plutôt
que de dupliquer le détecteur du pipeline documentaire
(`workers/knowledge-document-extractor.mjs`), qui vit dans `workers/` — sens
de dépendance inverse à celui d'un module `shared/`. Seules les expressions
email/téléphone sont reprises telles quelles.

Si un signal est détecté, `proposed_text` est **NULL en base** (jamais
stocké) — garanti par une contrainte de la migration
(`(proposed_text is null) = (cardinality(privacy_signals) > 0)`), pas
seulement par la discipline de la route. Une proposition dans cet état
**ne peut jamais être approuvée**, seulement rejetée (contrainte
`cardinality(privacy_signals) = 0 or status <> 'approved'` + vérification
applicative redondante dans `decision.ts`). Elle « entre en file » quand même
(traçabilité), conformément au bullet 1.

`provenance_status` pour une origine conversation est restreint à `observed`,
`inferred`, `user_confirmed`, `generated` (jamais `imported`, réservé aux
contenus officiels) — règle 2 du plan rendue structurelle une seconde fois,
au niveau de la file cette fois, avec la même logique que la contrainte LOT 1
sur `knowledge_sources` (`generated`/`inferred` ne peuvent jamais porter
`can_use_as_instruction` — vérifié ici aussi par
`provenanceAllowsUsePolicy`, nouvelle fonction pure exportée de
`shared/knowledge-use-policy.ts`, LOT 1, pour ne pas dupliquer la règle).

## Bullet 2 — passage « publié -> connaissance »

`api/flash/proposals/[id]/knowledge.ts` (POST) : n'accepte une activation
que si `flash_info_versions.status = 'publiee'` pour la version courante de
l'actualité. Titre, texte, `validFrom` (= `publishedAt` de la version) et
`expiresAt` viennent **de la version flash elle-même**, jamais d'une saisie
libre — copier `expiresAt` est ce qui garantit qu'une expiration flash
retire aussi la connaissance dérivée, sans code de retrait supplémentaire
(LOT 3 exclut déjà toute source expirée de `sourceIsAuthorizedAndCurrent`).

Une seule proposition active à la fois par actualité (`origin_flash_info_id`,
recherché sur la racine immuable, pas la version) : une nouvelle tentative
est refusée tant que la précédente n'est ni rejetée, ni approuvée-puis-
révoquée (le cas normal après une correction, voir bullet 3 — sinon une
actualité corrigée puis republiée ne pourrait plus jamais redevenir une
connaissance).

## Bullet 3 — retrait immédiat sur correction

`api/flash/proposals/[id]/correction.ts` : dans la **même transaction** que
la transition `publiee -> modifiee`, recherche par `flash_info_id` (racine
immuable — une actualité a pu être rendue utilisable depuis une version
antérieure à celle corrigée ici) toute proposition `approved` dont la source
liée est encore `published`, et la révoque immédiatement via
`revokeKnowledgeSourceAndDisableSkills` (désactive aussi toute compétence
dont elle était une source requise, comme une révocation manuelle).

Une expiration flash n'a besoin d'aucun code de retrait séparé : voir bullet
2 (copie d'`expiresAt`). Ce lot ne distingue pas « correction » et
« retrait » séparément — le système flash actuel (`shared/
flash-transitions.ts`) n'a qu'une seule transition légale depuis `publiee`
(`modifiee`), documentée par LOT 4 du plan de correction visible ; les deux
notions du plan de connaissance se rejoignent donc dans ce seul mécanisme.
Documenté ici plutôt que masqué.

## Bullet 4 — un brouillon Hebdo n'alimente jamais l'agent

Déjà vrai **par absence** avant ce lot : `api/content/admin/weekly-assist.ts`
ne fait aucune écriture en base (confirmé par lecture du fichier — aucun
import de `db/index`/`db/schema`, aucun `.insert(`, aucune transaction).
Ce lot ajoute une preuve structurelle testée
(`scripts/test-knowledge-source-proposal-structural-boundaries.mjs`) plutôt
que de se contenter de l'affirmer : le fichier est inspecté et l'absence
d'import base de données, d'insertion et de référence aux tables de
connaissance/flash est vérifiée à chaque exécution des tests.

## Bullet 5 — notification et connaissance restent deux décisions distinctes

`api/flash/proposals/[id]/knowledge.ts` et `api/knowledge/admin/proposals/
[id]/decision.ts` ne référencent jamais `flashNotificationDispatches`, ni
`resolveFlashDispatchPlan`, ni `persistFlashCommunicationBridge` — prouvé par
inspection statique (même fichier de test que le bullet 4) plutôt que par
relecture humaine.

## Preuves réellement exécutées

**Tests purs (aucune base) :**

- `npm run test:knowledge-source-proposal-policy` : 19/19 — validation des
  deux origines, la règle « générée/inférée ⇒ jamais consigne » rejouée au
  niveau de la file, détection email/téléphone/secret.
- `node --test scripts/test-knowledge-source-proposal-structural-boundaries.mjs` :
  5/5 — bullets 4 et 5 prouvés par inspection du code livré.
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur, exécuté
  après chaque étape.
- Suites existantes rejouées pour vérifier l'absence de régression sur les
  fichiers modifiés (`shared/knowledge-registry-input.ts`,
  `shared/knowledge-use-policy.ts`, `api/knowledge/admin/sources/[id]/
  action.ts`, `api/flash/proposals/[id]/correction.ts`) : `test:knowledge-use-
  policy` (30/30), `test:knowledge-registry-security` (7/7),
  `test:knowledge-registry-admin-action-payload` (8/8),
  `test:knowledge-document-review` (4/4), `test:knowledge-excerpts` (13/13),
  `test:public-skill-context` (16/16), `test:flash-correction` (10/10) —
  toutes vertes, aucune régression détectée.

**Preuve sur PostgreSQL réel jetable (pas sur une relecture du code)** :

`npx supabase start` puis `npx supabase db reset` : **106 migrations**
rejouées depuis zéro sans erreur (105 précédentes + la nouvelle
`20260906020000_create_knowledge_source_proposals.sql`).

MFA TOTP local temporairement activé pour cette seule recette
(`supabase/config.toml`, `enroll_enabled`/`verify_enabled` passés à `true`,
pile relancée sans `db reset`, données conservées), puis remis exactement à
son état d'origine après coup — `git status` confirmé propre sur ce fichier.
Même procédure, déjà établie et documentée, que `PUB-LOT4.md`.

`npm run recipe:local-knowledge-source-proposal-flow`
(`scripts/test-local-knowledge-source-proposal-flow.mjs`) : établissement,
trois comptes (proposant flash, validateur flash, responsable connaissance)
et actualité entièrement fictifs. Appelle les **vrais handlers HTTP**
(`api/flash/proposals/**`, `api/flash/proposals/[id]/knowledge.ts`,
`api/knowledge/admin/proposals/**`), avec des jetons réels émis par le GoTrue
local — session `aal2` réellement enrôlée en TOTP et vérifiée pour le
responsable connaissance, jamais un JWT fabriqué à la main.

**28 assertions, un seul passage, résultat `pass`** :

1. bootstrap réel d'une actualité publiée (proposer → valider → publier, vraies
   routes flash) ;
2. « rendre utilisable par l'agent » crée une proposition `pending_review`
   sans aucun signal de vie privée détecté (contenu fictif propre) ;
3. une seconde tentative sur la même actualité est refusée (409) ;
4. une tentative d'approbation avec une session `aal1` (jeton capturé avant
   l'enrôlement MFA) est refusée (403) ;
5. la seconde validation avec une session `aal2` réelle crée directement la
   source en base avec `status: 'published'` (jamais `'draft'`),
   `sourceType: 'flash_publication'`, `provenanceStatus`/`usePolicy` transmis
   tels quels, et `expiresAt` strictement identique à celui de la version
   flash publiée ;
6. cette source, liée à une compétence fictive publiée
   (`skill_source_links`, `required: true`), atteint réellement
   `loadPublicKnowledgeContext` (les instructions de la compétence
   apparaissent dans le contexte construit) ;
7. une correction réelle de l'actualité (`publiee -> modifiee`) **révoque
   immédiatement** la source dérivée (`status: 'revoked'` vérifié en base) et
   celle-ci **disparaît réellement** du contexte reconstruit par
   `loadPublicKnowledgeContext` juste après ;
8. une proposition « issue d'une discussion » contenant une adresse email
   fictive est créée avec `privacySignalCount: 1` et `proposedText: null` —
   son approbation est refusée (409), seul son rejet est accepté (200) ;
9. trois combinaisons interdites, tentées en SQL brut directement contre la
   table, sont **toutes rejetées par les contraintes de la migration** :
   provenance `generated` + `can_use_as_instruction` ; origine mixte
   (références conversation et flash simultanées) ; statut `approved` sans
   `source_id`.

Nettoyage : comptes `auth.users` fictifs supprimés (best-effort, réussi).
**Établissements et données flash/connaissance fictifs laissés en place** —
même limite déjà documentée par `PUB-LOT4.md` (`FK RESTRICT` sur
`flash_infos`/`flash_info_versions` → `institutions`, append-only par
conception) : la suppression complète n'est obtenue qu'en réinitialisant la
pile locale, ce qui a été fait après coup (`npx supabase db reset`, 106
migrations rejouées à nouveau, base repartie propre).

## Non vérifié / hors périmètre de ce lot

- `npx vite build`, `npm run test:preview-security-gate`,
  `npm run test:spec-integrity`, `npm run test:migration-integrity` :
  **non exécutés** — demandés par le plan à la clôture finale (§LOT 8), pas
  à chaque lot, même choix que LOT 3/LOT 4.
- **Défense en profondeur des payloads d'administration** : contrairement
  aux autres routes du registre (`shared/knowledge-document-admin-payload.ts`,
  `shared/knowledge-registry-admin-action-payload.ts`), les nouvelles routes
  de ce lot ne font pas suivre leur JSON d'un second parseur miroir qui
  revaliderait la forme exacte de ce qu'elles renvoient. Limitation
  documentée dans le code (`api/knowledge/admin/proposals/index.ts`), pas
  masquée : à combler avant une mise en production réelle.
- **Auto-approbation** : rien n'empêche la même personne de créer une
  proposition (décision A) et de l'approuver (décision B). Ni le plan ni les
  circuits existants (`review.ts`/`sources/action.ts`) n'imposent une
  séparation stricte proposant/validateur ; ce lot ne l'invente pas non plus.
  À trancher explicitement si une séparation des rôles est un jour exigée.
- **Republication après correction** : la logique de blocage des doublons
  (bullet 2) autorise une nouvelle proposition seulement quand la précédente
  est rejetée ou approuvée-puis-révoquée. Le cas d'une actualité corrigée
  PUIS republiée (nouvelle version `publiee`) a été anticipé dans la requête
  de blocage mais **pas rejoué en recette réelle** — seul le chemin
  publication → correction l'a été.
- **Recette navigateur** : aucune capture d'écran, aucun clic réel dans
  l'interface. Ce lot n'a ajouté aucun écran (aucune page React/Vue) : la
  file de validation n'a pas d'interface dédiée aujourd'hui, seulement les
  routes API. Une interface reste à construire si des personnes non
  techniques doivent l'utiliser.
- **Rétention de `knowledge_source_proposals`** : aucune politique de purge
  n'a été ajoutée ni discutée pour cette table (contrairement à LOT 4 qui
  avait posé un plancher explicite pour la trace de rappel). Angle mort
  signalé, pas résolu.

## Fichiers modifiés

- `supabase/migrations/20260906020000_create_knowledge_source_proposals.sql`
  (nouveau) : table `knowledge_source_proposals`, contraintes de paire
  d'origine, contrainte de triptyque statut/relecture/source, garde
  d'immutabilité des champs déclaratifs, extension de `agent_skill_audit`
  (`resource_type`, `action`) et de `knowledge_sources.source_type`
  (`flash_publication`, `conversation`).
- `db/schema.ts` (table `knowledgeSourceProposals`).
- `shared/knowledge-use-policy.ts` (nouvelle fonction pure
  `provenanceAllowsUsePolicy`, réutilisée par ce lot et par la contrainte
  SQL du LOT 1 qu'elle anticipe côté TypeScript).
- `shared/knowledge-registry-input.ts` (helpers `record`/`text`/`enumValue`/
  `dateValue`/`optionalDate`/`serviceCodes` exportés pour réutilisation ;
  `KNOWLEDGE_SOURCE_TYPES` étendu).
- `shared/knowledge-source-proposal-policy.ts` (nouveau) : origines
  autorisées, provenance autorisée par origine, parseurs d'entrée pour les
  deux origines et pour la décision, détection de signal personnel/secret.
- `api/_shared/knowledge-source-revocation.ts` (nouveau) : révocation
  extraite de `sources/[id]/action.ts`, réutilisée par ce fichier et par la
  correction flash.
- `api/knowledge/admin/sources/[id]/action.ts` (refactor pur, revoke délégué
  au helper ci-dessus — comportement inchangé, testé).
- `api/knowledge/admin/proposals/index.ts` (nouveau) : GET file, POST
  proposition issue d'une conversation.
- `api/knowledge/admin/proposals/[id]/decision.ts` (nouveau) : seconde
  validation (approve/reject).
- `api/flash/proposals/[id]/knowledge.ts` (nouveau) : « rendre utilisable par
  l'agent ».
- `api/flash/proposals/[id]/correction.ts` (révocation immédiate de la
  connaissance dérivée ajoutée dans la transaction existante).
- `scripts/test-knowledge-source-proposal-policy.mjs`,
  `scripts/test-knowledge-source-proposal-structural-boundaries.mjs`,
  `scripts/test-local-knowledge-source-proposal-flow.mjs` (nouveaux).
- `package.json` (`test:knowledge-source-proposal-policy`,
  `test:knowledge-source-proposal-boundaries`,
  `recipe:local-knowledge-source-proposal-flow`).

## Ordre recommandé pour la suite

1. LOT 6 (heure de Paris, contrôles de fraîcheur, quota du coffre) —
   indépendant de ce lot.
2. Trancher l'angle mort de rétention de `knowledge_source_proposals` avant
   qu'un volume réel de propositions ne s'accumule.
3. Construire l'écran d'administration de la file (aucun aujourd'hui) si des
   personnes non techniques doivent l'utiliser.
4. LOT 7 (tests adverses obligatoires) pourra directement réutiliser
   `scripts/test-local-knowledge-source-proposal-flow.mjs` comme socle pour
   ses scénarios 1 à 4 et 9 (déjà couverts en substance par ce lot).
