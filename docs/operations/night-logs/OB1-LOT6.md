# LOT 6 — Heure de Paris et contrôles de fraîcheur

Plan : `docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, section « LOT 6 ».
Constat de départ : `docs/operations/CARTOGRAPHIE_OB1_2026-09-05.md`, lignes 21
et 25 — le balayage de péremption tourne à `15 2 * * *` en **UTC** (donc à 3 h
ou 4 h heure de Paris selon la saison, jamais 2 h 15), le quota du coffre
compte la journée en UTC, et aucun contrôle de fraîcheur n'existe à 08 h,
13 h, 18 h heure de Paris. Portée stricte des trois puces du plan, plus le
correctif du coffre signalé dans la même section.

## Décision de conception

Vercel Cron ne connaît que l'UTC (aucun fuseau dans `vercel.json`) : un
horaire fixe ne peut donc pas suivre le changement d'heure d'été/hiver deux
fois par an sans intervention manuelle. La correction retenue n'est pas de
deviner un décalage UTC différent selon la saison, mais de :

1. faire tourner le cron `knowledge-expiry` **toutes les heures**
   (`"5 * * * *"`, toujours en UTC) ;
2. laisser un module pur, `shared/knowledge-freshness-schedule.ts`, décider —
   à partir de l'heure locale Paris **réelle** de `now` (via `Intl`, DST
   inclus) — si l'appel HTTP en cours correspond au balayage nocturne (2 h,
   héritier direct du `15 2 * * *` d'origine) ou à l'un des trois contrôles de
   fraîcheur (8 h, 13 h, 18 h). En dehors de ces quatre heures, la route
   répond sans ouvrir de transaction.

Le balayage lui-même (bascule des sources expirées, désactivation des
compétences dépendantes) a été **extrait**, sans réécriture, dans
`api/_shared/knowledge-freshness-sweep.ts::runKnowledgeFreshnessSweep`, pour
être rejoué à l'identique par :
- `api/cron/knowledge-expiry.ts` (passage planifié) ;
- les trois routes qui publient réellement quelque chose dans le registre —
  `api/knowledge/admin/sources/[id]/action.ts` (publish), `api/knowledge/
  admin/proposals/[id]/decision.ts` (approve) et `api/knowledge/admin/
  versions/[id]/action.ts` (publish) — pour la troisième puce du plan
  (« une publication déclenche un contrôle supplémentaire »), sans attendre
  le prochain créneau planifié.

Chaque appel porte un `trigger` (`scheduled_nightly_expiry`,
`scheduled_freshness_check` ou `publication`) qui atterrit dans
`agent_skill_audit.summary.trigger` — les trois causes ne sont jamais
confondues dans la même trace, même logique que le plan l'exige déjà pour
d'autres distinctions (LOT 2 du plan de publication flash).

`shared/paris-time.ts` (nouveau) centralise la seule conversion instant →
heure/date locale Paris (`Intl.DateTimeFormat`, `hourCycle: "h23"` pour
l'heure, locale `en-CA` pour la date ISO) : `shared/knowledge-
freshness-schedule.ts` et le correctif du coffre (voir plus bas) s'y
appuient tous les deux, pour ne jamais réinventer deux fois la même
conversion.

## Correctif du coffre (même défaut, même lot)

`api/_shared/code-vault-assignment.ts::recordVaultCodeDisplay` calculait la
journée du quota avec `params.now.toISOString().slice(0, 10)` — un jour UTC,
pas un jour Paris. Remplacé par `parisDateStringOf(params.now)`
(`shared/paris-time.ts`). Comportement inchangé pour tout affichage en
journée ; corrigé pour la fenêtre 22 h–00 h/23 h–00 h UTC selon la saison, où
le compteur ne redémarrait pas encore alors que la journée scolaire suivante
avait déjà commencé à Paris.

## Défaut latent découvert en exécutant la recette (pas supposé à l'avance)

`api/cron/knowledge-expiry.ts` enregistre depuis sa création
`action: 'expire_automatic'` / `'disable_automatic'` dans
`agent_skill_audit` — ces deux valeurs n'ont **jamais** été ajoutées à la
contrainte `agent_skill_audit_action_check`. Aucun lot précédent n'avait
rejoué ce balayage contre une base réelle contenant effectivement une source
expirée ou une compétence en retard de revue (les preuves antérieures étaient
soit purement logiques, soit des lectures statiques du code). La première
exécution réelle de `runKnowledgeFreshnessSweep` contre PostgreSQL (recette de
ce lot) a fait échouer l'insertion d'audit — et, la transaction étant unique,
annulé **aussi** la mise à jour de péremption elle-même : le défaut aurait
donc rendu le cron nocturne totalement inopérant en production dès la
première source réellement expirée.

Corrigé par migration additive `supabase/migrations/
20260906030000_add_knowledge_expiry_automatic_actions.sql` (même patron que
les trois migrations précédentes qui ont étendu cette contrainte : `drop
constraint` puis `add constraint` avec la liste complète + les deux nouvelles
valeurs). Confirmé par `npx supabase db reset` (107 migrations rejouées sans
erreur) puis re-exécution de la recette, qui passe.

## Preuves réellement exécutées

**Tests purs (aucune base) :**

- `npm run test:paris-time` (nouveau) : 5/5 — conversion heure/date Paris
  correcte de part et d'autre du changement d'heure (CET hiver, CEST été),
  franchissement de minuit Paris distinct de minuit UTC.
- `npm run test:knowledge-freshness-schedule` (nouveau) : 9/9 — les quatre
  heures planifiées (2 h, 8 h, 13 h, 18 h) restent correctes en hiver et en
  été ; aucun déclenchement hors de ces heures ; preuves de wiring statique
  (le cron rejoue le module pur, n'ouvre pas de transaction hors créneau, le
  balayage vit dans un seul module, les trois routes de publication
  l'appellent bien).
- `npm run test:knowledge-expiry` (mis à jour) : 7/7 — `buildKnowledgeExpiryPlan`
  inchangé ; les deux assertions qui lisaient les littéraux `expire_automatic`/
  `disable_automatic` pointent désormais vers `api/_shared/
  knowledge-freshness-sweep.ts` (déplacés, pas dupliqués) ; l'ancienne
  assertion sur le cron quotidien fixe a été retirée (déplacée, avec plus de
  détail, dans le nouveau fichier).
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur.
- Suites existantes rejouées sans régression : `test:code-vault-policy`
  (16/16), `test:code-vault-delivery-policy` (5/5), `test:knowledge-use-policy`
  (30/30), `test:knowledge-registry-security` (7/7), `test:knowledge-source-
  proposal-policy` (19/19), `test:knowledge-registry-admin-action-payload`
  (8/8), `test:knowledge-source-proposal-boundaries` (5/5).

**Preuves sur PostgreSQL réel jetable (pas sur une relecture du code) :**

`npx supabase start` puis `npx supabase db reset` : **107 migrations**
rejouées depuis zéro sans erreur (106 précédentes + la nouvelle
`20260906030000`). Rejoué une seconde fois après l'ajout de la migration pour
confirmer que le défaut latent ci-dessus est bien corrigé.

- `npm run recipe:local-code-vault-assignment` : **29/29** (23 assertions
  préexistantes + 6 nouvelles). Le scénario 6 ajouté prouve, contre
  PostgreSQL réel, que le quota redémarre à minuit **Paris** alors que les
  deux instants comparés restent dans la **même** journée UTC (21 h et
  23 h 30 UTC un jour de septembre, CEST) — et j'ai vérifié que ce test
  **échoue** effectivement (`1 !== 2`) si l'on remet temporairement l'ancien
  calcul UTC en place, avant de restaurer le correctif : la preuve
  discrimine réellement l'ancien du nouveau comportement, elle n'est pas
  vacueuse.
- `npm run recipe:local-knowledge-freshness-sweep` (nouveau) : **12/12** —
  appelle directement `runKnowledgeFreshnessSweep` (pas via HTTP, mais la
  même fonction, sans duplication, que celle branchée dans les quatre routes
  réelles) : une source publiée déjà périmée et requise par une compétence
  active est bien passée à `expired`, la compétence dépendante désactivée et
  son `active_version_id` vidé, avec `summary.trigger = "publication"` dans
  la trace — puis, même fonction rejouée avec `trigger:
  "scheduled_freshness_check"`, une compétence en retard de revue (raison
  `review_overdue`, pas `source_expired`) est désactivée avec le motif
  d'audit distinct attendu.
- `npm run recipe:local-knowledge-source-proposal-flow` (régression LOT 5,
  dont l'approbation appelle désormais `runKnowledgeFreshnessSweep` dans la
  même transaction) : **28/28**, aucune régression — preuve que l'appel
  supplémentaire ne casse pas le flux HTTP réel de bout en bout avec
  sessions `aal2` réelles.
- `npm run test:migration-integrity` : 107 migrations, 107 versions
  uniques, 78 références vérifiées.
- `npm run test:spec-integrity` : exécuté, sans lien direct avec ce lot (ce
  plan OB1 n'a pas de tâches dans `tasks.md`), aucune anomalie.
- `npx vite build` (`npm run build`) : succès.
- `npm run test:preview-security-gate` : suite complète exécutée jusqu'au
  bout, **0 échec**.

## Non vérifié / hors périmètre de ce lot

- **`api/knowledge/admin/sources/[id]/action.ts` (publish) et `api/knowledge/
  admin/versions/[id]/action.ts` (publish) : le déclenchement du contrôle
  supplémentaire n'a été exercé contre PostgreSQL réel que via la fonction
  partagée directement (`recipe:local-knowledge-freshness-sweep`), pas via un
  appel HTTP complet à ces deux routes précises** (contrairement à la route
  d'approbation de proposition, couverte par la recette HTTP existante du
  LOT 5). Couvert par : lecture statique du wiring
  (`scripts/test-knowledge-freshness-schedule.mjs`), `tsc --noEmit`, et la
  logique du balayage lui-même prouvée en base réelle par ailleurs. Aucune
  recette HTTP de bout en bout dédiée à ces deux routes n'existait avant ce
  lot ; en créer une pour prouver spécifiquement ce point reste à faire si
  jugé nécessaire.
- **Vercel Cron réel** : le passage de `"15 2 * * *"` à `"5 * * * *"` n'a pas
  pu être observé en exécution réelle sur l'infrastructure Vercel — interdit
  par CLAUDE.md (« Aucune mutation Vercel »). La preuve reste la fonction
  pure de décision (`scheduledKnowledgeSweepTrigger`) et son wiring statique
  dans la route.
- **Rétroactivité** : les sources déjà expirées avant ce lot mais jamais
  balayées avec succès (à cause du défaut `agent_skill_audit_action_check`
  découvert ici) n'ont pas été recherchées en production — hors de portée
  d'une recette locale jetable ; à vérifier par Adel si une base réelle
  existe déjà avec des exécutions passées de ce cron.

## Fichiers modifiés

- `shared/paris-time.ts` (nouveau) : conversion instant → heure/date locale
  Paris, seul point d'entrée pour cette conversion.
- `shared/knowledge-freshness-schedule.ts` (nouveau) : décision pure des
  quatre heures planifiées (2 h, 8 h, 13 h, 18 h Paris).
- `api/_shared/knowledge-freshness-sweep.ts` (nouveau) : balayage réel
  extrait de `api/cron/knowledge-expiry.ts`, paramétré par `trigger`.
- `api/cron/knowledge-expiry.ts` : ne fait plus que vérifier le secret puis
  déléguer selon l'heure Paris réelle.
- `api/_shared/code-vault-assignment.ts` : quota quotidien du coffre calculé
  en jour Paris, plus en jour UTC.
- `api/knowledge/admin/sources/[id]/action.ts`,
  `api/knowledge/admin/proposals/[id]/decision.ts`,
  `api/knowledge/admin/versions/[id]/action.ts` : appellent
  `runKnowledgeFreshnessSweep(..., "publication")` après avoir publié.
- `vercel.json` : cron `knowledge-expiry` passé de `"15 2 * * *"` à
  `"5 * * * *"`.
- `supabase/migrations/20260906030000_add_knowledge_expiry_automatic_actions.sql`
  (nouveau) : ajoute `expire_automatic`/`disable_automatic` à
  `agent_skill_audit_action_check` (correction d'un défaut latent
  préexistant, découvert par la recette de ce lot).
- `scripts/test-paris-time.mjs`, `scripts/test-knowledge-freshness-schedule.mjs`,
  `scripts/test-local-knowledge-freshness-sweep.mjs` (nouveaux).
- `scripts/test-knowledge-expiry-policy.mjs` (assertions déplacées vers le
  nouveau fichier du balayage, schedule fixe retiré).
- `scripts/test-local-code-vault-assignment.mjs` (scénario 6 ajouté : quota
  autour de minuit Paris).
- `package.json` (`test:paris-time`, `test:knowledge-freshness-schedule`,
  `recipe:local-knowledge-freshness-sweep`).

## Ordre recommandé pour la suite

1. LOT 7 (tests adverses obligatoires) — peut réutiliser
   `runKnowledgeFreshnessSweep` et `scheduledKnowledgeSweepTrigger` tels
   quels pour ses scénarios sur l'expiration/le remplacement (items 4 et 10
   de la liste du LOT 7).
2. Si une base de production existe déjà avec des exécutions passées du
   cron `knowledge-expiry`, vérifier avec Adel si des balayages ont
   effectivement échoué silencieusement à cause du défaut
   `agent_skill_audit_action_check` corrigé ici, et si un rattrapage manuel
   est nécessaire.
3. LOT 8 (clôture honnête).
