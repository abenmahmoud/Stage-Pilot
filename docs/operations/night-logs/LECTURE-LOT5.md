# LECTURE — LOT 5 : clôture honnête (deuxième passage)

Date : 6 septembre 2026. Plan : `docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`,
section « LOT 5 — Clôture honnête ». Tout le travail de cette session
(lecture des comptes rendus et du code, exécution des quatre vérifications
finales, rédaction) a eu lieu ici, sans agent en arrière-plan.

## Pourquoi ce fichier est réécrit

Une première clôture du LOT 5 avait été committée (`62c0dfa`,
« LOT 5 lecture - cloture honnete, LOT 3 non abouti documente, T069 laissee
ouverte ») **avant** que le LOT 3 et le LOT 4 de ce même plan n'aboutissent
réellement. Depuis, deux commits sont venus après cette clôture prématurée :

- `78bcd26` — « LOT 3 lecture - compte rendu du branchement
  ent-inactif/cantine/koxo », avec `docs/operations/night-logs/LECTURE-LOT3.md`.
- `f637970` — « LOT 4 lecture - recette adverse avec marqueur traque partout »,
  avec `docs/operations/night-logs/LECTURE-LOT4.md`.

La clôture `62c0dfa` est donc **périmée** : elle décrivait un état où le LOT 3
avait disparu sans committer. Ce n'est plus l'état du dépôt. Cette session
relit les deux comptes rendus réels (LOT 3, LOT 4), vérifie elle-même ce
qu'ils affirment plutôt que de les recopier, et rédige la clôture qui reflète
l'état actuel.

## Ce qui est réellement prouvé, lot par lot

- **LOT 1 — point de lecture unique** : committé (`5f5b376`),
  `docs/operations/night-logs/LECTURE-LOT1.md`. Non rejoué dans cette session
  (hors périmètre du LOT 5), mais son test structurel fait partie de la
  suite `tsc`/build revérifiée ci-dessous.
- **LOT 2 — drapeau fermé par défaut** : committé (`9c60fa4`),
  `docs/operations/night-logs/LECTURE-LOT2.md`. Reconfirmé dans cette
  session par lecture directe : `.env.local.example` ligne 77 porte toujours
  `CODE_VAULT_REVEAL_ENABLED=false`.
- **LOT 3 — brancher ent-inactif, cantine, koxo** : committé (`78bcd26`).
  Le compte rendu documente un branchement relu ligne à ligne
  (`resolveVaultCodeReveal` atteignable uniquement depuis
  `outcome === "displayed"`) et des preuves rejouées sur PostgreSQL réel
  local (`recipe:local-code-vault-ent-inactif-route`,
  `recipe:local-code-vault-service-delivery-route`,
  `recipe:local-code-vault-branchement-adversarial`, toutes avec
  `rollbackVerified: true`, `realData: false`). Écart signalé par ce lot
  lui-même, non comblé depuis : cantine et koxo n'ont pas de page dédiée dans
  ce dépôt, donc leur branchement n'est prouvé que jusqu'à la réponse de la
  route, pas jusqu'à un composant monté.
- **LOT 4 — recette adverse avec marqueur traqué partout** : committé
  (`f637970`). Le compte rendu documente un balayage explicite de
  `code_vault_access_events`, `agent_skill_audit`, la sortie console
  capturée, les réponses d'erreur sanitisées et le contexte modèle, sur les
  trois parcours, avec `recipe:local-code-vault-lecture-adversarial`
  (`rollbackVerified: true`, `realData: false`) et une recette navigateur
  Chromium réelle rejouée dans la même session. Aucune fuite trouvée. Écart
  signalé par ce lot lui-même, non comblé : la recette navigateur exerce le
  composant seul (valeur passée en prop), pas encore le trajet complet
  route réelle → réseau → composant.

Je n'ai pas rejoué ces recettes PostgreSQL et navigateur moi-même dans cette
session de clôture : les comptes rendus LOT 3 et LOT 4 sont committés, avec
chemins explicites et preuves détaillées, ce qui satisfait la règle du plan
(« une preuve locale non committée dans la session du lot n'est pas une
clôture de lot ») — contrairement à la première tentative de LOT 5, ici les
lots qu'elle clôture sont bien committés.

## Le cinquième parcours, ENT actif : toujours absent

`docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md`, LOT 1, doit le
construire. Vérifié dans cette session :

- Aucun fichier ne contient `ent-actif`, `EntActif` ni `ent_actif` dans
  `api/`, `shared/` ou `src/` (recherche explicite, zéro résultat).
- `api/vault/` ne contient que quatre routes :
  `ent-inactif.ts`, `koxo.ts`, `cantine.ts`, `messagerie-academique.ts`.
  Aucune route `ent-actif.ts`.
- Aucun `docs/operations/night-logs/SUITE-LOT*.md` n'existe : ce plan n'a
  commencé sur aucun de ses cinq lots.

**Ce plan n'a pas tourné.** Le cinquième parcours reste à construire.

## T069 — peut-elle être cochée ?

**Non.** Vérifié directement : `specs/002-agent-etablissement-adaptatif/tasks.md`
ligne 1173, `T069` reste `[ ]`. Elle exige les cinq parcours (ENT inactif et
**actif**, cantine, Koxo, messagerie académique) avec preuve, composant
sécurisé, aucun secret, formulaire humain de repli.

Elle a deux manques indépendants, et ce plan (`PLAN_LECTURE_COFFRE_2026-09-06.md`)
n'en comble qu'un :

1. **Le point de lecture des trois parcours à code (ENT inactif, cantine,
   Koxo)** — comblé par les LOT 1 à 4 de ce plan, réellement committés et
   prouvés comme détaillé ci-dessus.
2. **Le cinquième parcours, ENT actif** — non comblé. Traité par
   `PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md`, LOT 1, qui n'a pas encore tourné
   (aucun `SUITE-LOT1.md`, aucune route `ent-actif`).

Je ne coche pas T069.

## Rappel en clair pour Adel

- **Le drapeau `CODE_VAULT_REVEAL_ENABLED` reste fermé** partout dans ce
  dépôt — `.env.local.example` le documente à `false`, aucune route ne
  l'active, aucun commit de ce plan ne le touche en dehors de l'objet `env`
  passé en paramètre aux recettes locales (LOT 4, jamais `process.env`).
- **L'import réel de codes reste une décision non prise.** Rien dans ce plan
  ni dans cette clôture ne l'engage.
- Le coffre ne contient toujours aucun code réel : rien de ce qui précède
  n'expose une donnée d'élève ou de professeur.

## Preuves de clôture exécutées dans cette session

- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npx vite build` → succès (`✓ built in 19.87s`).
- `npm run test:preview-security-gate` → code de sortie 0, aucune ligne
  `not ok` ni `Error` dans la sortie complète (vérifié par recherche
  explicite dans le journal complet, pas seulement par le code de sortie).
- `npm run test:spec-integrity` → succès, 5 specs, 635 tâches,
  `002-agent-etablissement-adaptatif` : 229 tâches complétées, 71 ouvertes
  (T069 comprise).

Ces quatre preuves ont tourné sur l'état actuel de l'arbre de travail (LOT 1
à 4 de ce plan déjà committés, rien d'autre ajouté par cette session avant de
les lancer).

## Périmètre respecté

Branche `codex/lycee-connect-prototype`, aucun `git push`, aucun drapeau
activé, aucune donnée réelle, aucun envoi, aucun déploiement, aucune lecture
de `~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun agent en arrière-plan :
tout le travail de cette session a eu lieu ici. Seul ce fichier est committé
par cette session, avec son chemin explicite ; les fichiers déjà présents
dans l'arbre de travail avant cette session (`docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`,
`nuit.ps1`, `.nuit-coffre.lock`, `.nuit-lecture.lock`,
`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`,
`docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md`, `nuit-coffre.ps1`,
`nuit-lecture.ps1`, `nuit-suite.ps1`) sont hors périmètre de ce lot et n'ont
pas été touchés.
