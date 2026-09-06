# LECTURE — LOT 5 : clôture honnête

Date : 6 septembre 2026. Plan : `docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`,
section « LOT 5 — Clôture honnête ». Contexte reçu au démarrage de cette
session : **le LOT 3 n'a pas abouti**, avec consigne explicite d'en documenter
l'erreur exacte sans la masquer.

## Ce qui a réellement abouti

- **LOT 1 — point de lecture unique** : committé (`5f5b376`), `docs/operations/night-logs/LECTURE-LOT1.md`.
- **LOT 2 — drapeau fermé** : committé (`9c60fa4`), `docs/operations/night-logs/LECTURE-LOT2.md`.
  Confirmé à nouveau dans cette session : `.env.local.example` porte toujours
  `CODE_VAULT_REVEAL_ENABLED=false`, aucune route ne l'ouvre.

## LOT 3 — l'échec exact, sans le masquer

**Aucun commit, aucun compte rendu.** `docs/operations/night-logs/LECTURE-LOT3.md`
n'existe pas. `git log` ne contient aucun commit « LOT 3 lecture ». Le fichier
`.nuit-lecture.lock` de cette nuit porte l'horodatage `20260906-162730`, et
seuls `20260906-162730-LOT1.log` et `20260906-162730-LOT2.log` existent dans
`docs/operations/night-logs/` — **il n'existe même pas de
`20260906-162730-LOT3.log`**, alors que `nuit-lecture.ps1` capture la sortie de
chaque lot via `Tee-Object` dès le lancement du processus. Autrement dit, la
session du LOT 3 s'est interrompue d'une manière qui n'a laissé aucune trace
de log exploitable — pas seulement un compte rendu manquant.

Ce qui reste, en revanche, dans l'arbre de travail : **des modifications non
committées**, sur exactement les fichiers attendus du LOT 3, horodatées entre
16:50 et 16:55 (juste après la fin du LOT 2 à 16:46) :

- `api/_shared/code-vault-ent-inactif-route.ts`
- `api/_shared/code-vault-service-delivery-route.ts`
- `shared/code-vault-ent-inactif-screen.ts`
- `src/pages/coffre/CoffreEntInactifPage.tsx`
- `scripts/test-code-vault-ent-inactif-screen.mjs`, `scripts/test-code-vault-ent-inactif-page.mjs`
- `scripts/test-local-code-vault-ent-inactif-route.mjs`, `scripts/test-local-code-vault-service-delivery-route.mjs`
- `scripts/test-local-code-vault-branchement-adversarial.mjs` (mise à jour de
  non-régression sur la nouvelle forme de réponse)

Ces diffs branchent bien `resolveVaultCodeReveal` (LOT 1/2) dans
`handleEntInactifVaultRequest` et `handleServiceDeliveryVaultRequest`, et
propagent `value`/`reason` jusqu'à `CodeVaultSecureDisplay` via l'état
`revealed` — exactement le périmètre décrit par le LOT 3 du plan. La session
qui les a écrits a disparu **avant** l'étape « commit avec chemins explicites
+ compte rendu » exigée par les règles de périmètre du plan.

### Ce que cette session (LOT 5) a vérifié, par honnêteté — sans se substituer au LOT 3

Le LOT 3 devait produire sa propre preuve dans sa propre session ; il ne l'a
pas fait. Ce qui suit n'est **pas** la preuve du LOT 3 — c'est une
constatation faite ici, sur l'état actuel, non committé, de l'arbre de
travail, pour ne rien cacher à Adel :

- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npm run test:code-vault-ent-inactif-route`, `test:code-vault-service-delivery-route`,
  `test:code-vault-ent-inactif-screen`, `test:code-vault-ent-inactif-page` → tous verts.
- `npm run recipe:local-code-vault-ent-inactif-route --local-stack-only` (PostgreSQL réel
  jetable, `127.0.0.1:54322`) → `{"assertions":30,"rollbackVerified":true,"realData":false}`.
- `npm run recipe:local-code-vault-service-delivery-route --local-stack-only` (cantine et
  koxo) → `{"assertions":44,"rollbackVerified":true,"realData":false}`.
- `npm run recipe:local-code-vault-branchement-adversarial --local-stack-only` (non-régression
  du LOT 6 du plan de branchement, mis à jour par la session disparue) →
  `{"assertions":34,"rollbackVerified":true,"realData":false}`.

Ces cinq preuves passent, sur les trois parcours (ENT inactif, cantine, koxo),
drapeau fermé et drapeau ouvert testés dans l'`env` de recette uniquement.
**Cela ne rend pas le LOT 3 acquis** : rien n'est committé, personne ne l'a
revu dans le cadre du LOT 3 lui-même, et la règle du plan est claire — une
preuve locale non committée dans la session du lot n'est pas une clôture de
lot. Je ne coche donc rien pour le LOT 3 et je ne committe pas ces fichiers
ici : ce n'est pas mon lot à fermer, et le faire sous couvert du LOT 5
masquerait exactement l'échec qu'on m'a demandé de documenter.

**Recommandation pour Adel** : soit rejouer explicitement une session LOT 3
qui reprend ces modifications déjà présentes dans l'arbre de travail et les
committe avec son propre compte rendu, soit les écarter s'il préfère repartir
d'une base propre. Dans les deux cas, ce choix relève d'une décision humaine,
pas de cette clôture.

## LOT 4 — jamais atteint

Conséquence directe de l'échec du LOT 3 : `nuit-lecture.ps1` s'arrête au
premier lot sans compte rendu et saute directement à la clôture. Aucun
`docs/operations/night-logs/LECTURE-LOT4.md` n'existe. La recette adverse
avec marqueur traqué partout, exigée par le LOT 4 du plan, **n'a pas tourné**
dans le cadre de ce plan.

## T069 — peut-elle être cochée ?

**Non.** Elle porte deux manques indépendants, et aucun des deux n'est comblé
aujourd'hui :

1. **Le point de lecture des trois parcours à code** (l'objet de ce plan) :
   le LOT 3 qui le branche n'a pas abouti — non committé, sans compte rendu,
   comme documenté ci-dessus. Le LOT 4 (recette adverse) n'a donc pas pu
   tourner non plus.
2. **Le cinquième parcours, ENT actif** : traité par
   `docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md`. Aucun
   `docs/operations/night-logs/SUITE-LOT1.md` n'existe, et le fichier de plan
   lui-même le constate au LOT 1 : « ENT actif n'existe nulle part — ni
   route, ni assemblage, ni page. » Ce plan n'a pas encore tourné.

`specs/002-agent-etablissement-adaptatif/tasks.md` ligne 1173 : T069 reste
`[ ]`, à raison — elle exige les cinq parcours avec preuve, composant
sécurisé, aucun secret, et formulaire humain de repli. Je ne la coche pas.

## Rappel en clair pour Adel

- **Le drapeau `CODE_VAULT_REVEAL_ENABLED` reste fermé** partout dans ce
  dépôt — `.env.local.example` le documente à `false`, aucune route ne
  l'active, aucun commit de cette session ne le touche.
- **L'import réel de codes reste une décision non prise.** Rien dans ce plan
  ni dans cette clôture ne l'engage.
- Le coffre ne contient toujours aucun code réel : rien de ce qui précède
  n'expose une donnée d'élève ou de professeur.

## Preuves de clôture exécutées dans cette session

- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npx vite build` → succès (`✓ built in 28.37s`).
- `npm run test:preview-security-gate` → code de sortie 0, aucune ligne `not ok`
  ni `Error:` dans la sortie complète (vérifié explicitement par lecture du
  journal complet, pas seulement par le code de sortie).
- `npm run test:spec-integrity` → succès, 5 specs, 635 tâches, aucune anomalie
  signalée.

Ces quatre preuves ont tourné sur l'état actuel de l'arbre de travail, c'est-à-
dire **avec** les modifications non committées du LOT 3 disparu présentes sur
le disque (rien n'a été ajouté ni retiré par cette session avant de les
lancer). Elles ne couvrent pas les recettes PostgreSQL réelles ni les
recettes navigateur, qui sont rapportées séparément ci-dessus.

## Périmètre respecté

Branche `codex/lycee-connect-prototype`, aucun `git push`, aucun drapeau
activé, aucune donnée réelle, aucun envoi, aucun déploiement. Aucun agent en
arrière-plan : tout le travail de cette session (lecture, exécution de
recettes réelles, rédaction) a eu lieu ici. Seul ce fichier est committé par
cette session, avec son chemin explicite ; les fichiers modifiés ou non
suivis laissés par la session LOT 3 disparue, et les scripts `nuit*.ps1` /
fichiers `.nuit-*.lock` d'autres sessions, ne sont ni committés ni modifiés
ici.
