# LOT 3 — Brancher le filtre serveur

Plan : `docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, section « LOT 3 ».
S'appuie sur les colonnes du LOT 1 (`provenance_status`, `use_policy`, voir
`docs/operations/night-logs/OB1-LOT1.md`) et sur `decideKnowledgeSourceUsage`
du LOT 2 (`docs/operations/night-logs/OB1-LOT2.md`). Portée stricte : câbler
le LOT 2 dans `sourceIsAuthorizedAndCurrent` et dans le chargeur
`api/_shared/public-knowledge-context.ts`, côté serveur uniquement. Aucun
outil du coffre de codes touché.

## Écart trouvé avant de câbler quoi que ce soit

Le LOT 1 n'avait ajouté les colonnes qu'en SQL brut
(`supabase/migrations/20260906010000_add_knowledge_source_provenance.sql`) :
`db/schema.ts` (le schéma Drizzle utilisé par tout le code serveur) n'avait
jamais été mis à jour. Sans ça, le chargeur ne peut pas lire
`provenance_status` ni `use_policy` : c'est un préalable strict au câblage,
pas une extension du périmètre. Ajouté uniquement `provenanceStatus` et
`usePolicy` à `knowledgeSources` dans `db/schema.ts` (mêmes noms de colonnes,
mêmes défauts que la migration). `superseded_by`, `review_comment`,
`reviewed_by`, `reviewed_at` existent aussi en base mais ne sont repris nulle
part : aucune requête de ce lot (ni d'aucun lot livré) n'en a besoin — le LOT
2 documentait déjà explicitement cette même exclusion pour son propre module
d'entrée.

## Écarter une dépendance circulaire avant de câbler

`sourceIsAuthorizedAndCurrent` (dans `shared/public-agent-skill-policy.ts`)
devait déléguer à `decideKnowledgeSourceUsage` (dans
`shared/knowledge-use-policy.ts`). Mais `knowledge-use-policy.ts` importait
déjà `classificationIsPromptSafe` depuis `public-agent-skill-policy.ts` — un
câblage direct aurait créé une dépendance circulaire entre les deux modules.
Plutôt que d'accepter le cycle (fragile, et contraire à l'esprit « étendre
sans réécrire » du LOT 2), `classificationIsPromptSafe` a été déplacée telle
quelle (aucune ligne de logique changée) dans `knowledge-use-policy.ts`, qui
devient ainsi la seule racine partagée. `public-agent-skill-policy.ts`
importe désormais `classificationIsPromptSafe` ET `decideKnowledgeSourceUsage`
depuis `knowledge-use-policy.ts` : la dépendance ne va plus que dans un sens.
Comportement inchangé, vérifié par les 13 tests existants de
`test:public-skill-context` qui passent toujours à l'identique.

`scripts/test-identity-access-policy.mjs` avait un test qui relisait le
fichier source de `public-agent-skill-policy.ts` pour vérifier littéralement
qu'il appelle `authorizeIdentityRoleAction(` — vrai avant ce lot, faux après
le déplacement (l'appel direct est maintenant dans `knowledge-use-policy.ts`).
La garantie qu'il vérifie (une seule décision identité/rôle, jamais
réimplémentée) reste vraie, juste relocalisée : le test a été corrigé pour
vérifier la chaîne transitive (`public-agent-skill-policy.ts` importe
`classificationIsPromptSafe`/`decideKnowledgeSourceUsage` de
`knowledge-use-policy.ts`, qui seule appelle `authorizeIdentityRoleAction`).

## Ce qui a été câblé

### `sourceIsAuthorizedAndCurrent` (`shared/public-agent-skill-policy.ts`)

Remplacé l'implémentation manuelle (dates, institution, classification) par
un seul appel à `decideKnowledgeSourceUsage`. Une source requise ne passe
plus que si la décision retournée est exactement `instruction`. Toute autre
décision (`evidence`, `requires_confirmation`, `do_not_inject`) fait échouer
la source — et comme `skillIsAuthorizedAndCurrent` exige que **toutes** les
sources requises passent, une compétence dont l'unique source requise
bascule en `can_use_as_evidence` (ou `superseded`, `disputed`,
`requires_human_confirmation`, `do_not_inject_automatically`) disparaît
entièrement du registre de consignes — comportement déjà démontré par les
tests unitaires ajoutés (voir Preuves).

`PublicAgentSkillSource` porte désormais `provenanceStatus` et `usePolicy`
(types importés de `knowledge-use-policy.ts`), remplis dans le chargeur DB.

### Chargeur (`api/_shared/public-knowledge-context.ts`)

Le chargeur évalue maintenant `decideKnowledgeSourceUsage` une seconde fois,
**indépendamment de l'autorisation d'un skill** : sur chaque source liée à un
skill de l'établissement (dédupliquées par id), pour l'acteur et l'instant
courants. Les sources dont la décision est `evidence` sont citées — titre,
statut, date de validité — via une nouvelle fonction pure,
`formatKnowledgeEvidenceCitations` (`shared/knowledge-use-policy.ts`), dans un
nouveau bloc `<sources_citees_comme_preuve>` séparé du registre de consignes
`<registre_autorise_valide>`. Le texte du bloc rappelle explicitement qu'une
citation « n'est jamais une consigne ». C'est cette séparation textuelle,
visible dans le contexte réellement transmis au modèle, que le plan demande
— pas un commentaire de code.

Les sources dont la décision est `evidence` rejoignent aussi la liste
`sources` retournée par le chargeur (utilisée pour l'audit
`consult_public` et pour les `sourceReferences` montrées à l'appelant dans
`api/_shared/support-agent.ts`), au même titre que les sources dont
l'extrait a été retenu — c'est le même mécanisme de citation, juste une
deuxième voie pour l'alimenter.

## Preuves réellement exécutées

**Tests purs (aucune base) :**
- `npm run test:knowledge-use-policy` : 25/25 (23 tests LOT 2 inchangés +
  2 nouveaux tests pour `formatKnowledgeEvidenceCitations`, la fonction de
  citation ajoutée par ce lot).
- `npm run test:public-skill-context` : 16/16 (13 tests LOT 2 inchangés
  à l'identique + 3 nouveaux tests qui prouvent, au niveau du module pur,
  qu'une source requise bascule en échec dès que sa décision LOT 2 n'est
  plus `instruction` — `can_use_as_evidence`, `superseded`/`disputed`,
  `requires_human_confirmation`/`do_not_inject_automatically`).
- `npm run test:identity-access` : 14/14, y compris le test corrigé
  (garantie « une seule décision identité/rôle » vérifiée transitivement).
- `npm run test:adversarial-boundaries` (regroupe support-contact-input,
  identity-access, knowledge-actor, public-skill-context,
  agent-tool-policy) : tout passe.
- `npm run test:support-agent` + `test:assistant-school-context` : 24/24,
  aucune régression sur le pipeline modèle qui consomme le contexte du
  chargeur.
- `npm run test:knowledge-excerpts` : 13/13, pipeline d'extraits inchangé.
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur, exécuté
  après chaque étape de refactor (déplacement de fonction, nouveaux champs,
  câblage du chargeur).

**Preuve sur PostgreSQL réel jetable (pas sur une relecture du code), la
preuve explicitement demandée par le plan :**

Nouveau script `scripts/test-local-knowledge-context-evidence-separation.mjs`
+ `npm run recipe:local-knowledge-context-evidence-separation`
(`--local-stack-only` obligatoire, cible codée en dur `127.0.0.1:54322`,
n'hérite jamais de `DATABASE_URL`). Établissement, compte et compétence
entièrement fictifs (marqueur aléatoire par exécution). Assemble les briques
déjà livrées (LOT 1 migration, LOT 2 `decideKnowledgeSourceUsage`, LOT 3
`loadPublicKnowledgeContext` réel) sans réimplémenter de règle :

- `npx supabase start` puis `npx supabase db reset` : **105 migrations**
  rejouées depuis zéro sans erreur (aucune migration ajoutée par ce lot).
- `npm run recipe:local-knowledge-context-evidence-separation`, exécuté deux
  fois de suite, **10 assertions** à chaque fois, mêmes résultats :
  1. Avec la source requise encore à sa valeur par défaut LOT 1
     (`can_use_as_instruction`), le contexte réellement construit par
     `loadPublicKnowledgeContext` contient `<registre_autorise_valide>`, le
     nom de la compétence et le titre de la source à l'intérieur de ce
     registre ; aucun bloc `<sources_citees_comme_preuve>` n'existe encore.
  2. Après un `UPDATE knowledge_sources SET use_policy = 'can_use_as_evidence'`
     réel en base (pas une simulation), un second appel au même chargeur
     montre : le registre de consignes a disparu (plus de
     `<registre_autorise_valide>`, plus le nom de la compétence — sa seule
     source requise ne peut plus le justifier) ; le titre de la source
     apparaît maintenant uniquement dans le nouveau bloc
     `<sources_citees_comme_preuve>` ; la source reste listée dans
     `sources` (audit `consult_public` et citations à l'appelant).
- Nettoyage vérifié par lecture directe de la base (pas par confiance) :
  après exécution, `select count(*) from institutions where slug like
  'ob1-lot3-recette-%'` et l'équivalent sur `knowledge_sources` et
  `auth.users` renvoient tous `0`.
- `npx supabase stop` après vérification.

## Non vérifié / hors périmètre de ce lot

- `npx vite build` et `npm run test:preview-security-gate` /
  `test:spec-integrity` : **non exécutés**, demandés par le plan à la
  clôture finale (§LOT 8), pas à chaque lot.
- Aucune preuve sur un environnement distant : uniquement la pile Supabase
  locale jetable, conformément à CLAUDE.md (« une preuve locale n'est pas une
  recette distante »).
- LOT 4 (trace de rappel étendue avec le motif du LOT 2) : non commencé.
  Ce lot ne modifie pas `agent_skill_audit` au-delà de ce qui existait déjà
  (les nouvelles sources `evidence` empruntent le même chemin d'audit que les
  sources déjà citées via extrait, sans nouveau champ).
- Le chemin d'extraits (`knowledge_source_excerpts`) n'a pas été exercé par
  la recette PostgreSQL de ce lot (aucune ligne d'extrait insérée : le
  scénario minimal suffisant ne l'exigeait pas) — il reste couvert par ses
  propres tests (`test:knowledge-excerpts`, 13/13, inchangés).
- `superseded_by`, `review_comment`, `reviewed_by`, `reviewed_at` restent
  absents de `db/schema.ts` : aucune requête de ce dépôt n'en a besoin
  aujourd'hui (cf. écart documenté plus haut).

## Fichiers modifiés

- `db/schema.ts` (`provenanceStatus`, `usePolicy` ajoutés à `knowledgeSources`)
- `shared/knowledge-use-policy.ts` (`classificationIsPromptSafe` déplacée
  ici depuis `public-agent-skill-policy.ts` ; nouvelle fonction pure
  `formatKnowledgeEvidenceCitations`)
- `shared/public-agent-skill-policy.ts` (`sourceIsAuthorizedAndCurrent`
  câblée sur `decideKnowledgeSourceUsage` ; `PublicAgentSkillSource` porte
  `provenanceStatus`/`usePolicy`)
- `api/_shared/public-knowledge-context.ts` (lit les deux nouvelles colonnes,
  calcule les citations `evidence` indépendamment de l'autorisation d'un
  skill, sépare le texte transmis au modèle en deux blocs)
- `scripts/test-knowledge-use-policy.mjs` (tests de
  `formatKnowledgeEvidenceCitations`)
- `scripts/test-public-agent-skill-policy.mjs` (tests prouvant l'échec d'une
  source requise dès que sa décision LOT 2 n'est plus `instruction`)
- `scripts/test-identity-access-policy.mjs` (test corrigé pour vérifier la
  garantie identité/rôle de façon transitive après le déplacement de
  fonction)
- `scripts/test-local-knowledge-context-evidence-separation.mjs` (nouveau,
  recette PostgreSQL réelle jetable)
- `package.json` (nouvelle entrée
  `recipe:local-knowledge-context-evidence-separation`)
- `docs/operations/night-logs/OB1-LOT3.md` (nouveau, ce fichier)
