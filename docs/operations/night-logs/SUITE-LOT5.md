# SUITE — LOT 5 : clôture honnête

Plan : `docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md`, §LOT 5.
Portée stricte : constat, pas de code, pas de sanitisation touchée. Ce lot
n'appelle pas `decryptVaultCodeValue`, n'en crée pas d'équivalent, n'affiche
aucune valeur de code. Tout le travail (lecture, exécution des contrôles,
rédaction) a eu lieu dans cette session, sans agent en arrière-plan.

## Correction du cadrage reçu

Le prompt de ce lot affirmait « Tous les lots demandés sont passés. » Ce
n'est **pas exact** pour le LOT 3 : voir plus bas. Ce compte rendu corrige
l'affirmation plutôt que de la répéter.

## Blocage d'environnement, reconfirmé dans cette session

`docker info` répond par une erreur 500 du moteur
(`request returned 500 Internal Server Error ... dockerDesktopLinuxEngine`)
et `docker ps` expire après 15 s sans jamais répondre. Même blocage que celui
déjà documenté par le LOT 2 (`SUITE-LOT2.md`). Conséquence : **aucune recette
PostgreSQL réelle n'a pu être (re)jouée dans cette session**, pour aucun lot.
Les contrôles finaux exigés par le plan (`tsc`, `vite build`,
`test:preview-security-gate`, `test:spec-integrity`) ne dépendent pas de
PostgreSQL et ont bien pu être exécutés — voir plus bas.

## LOT 1 — Cinquième parcours ENT actif : code écrit, recette réelle non prouvée

Commit `34fd6c2`. Fichiers présents et cohérents avec le plan :
`api/vault/ent-actif.ts` (relu dans cette session : même montage que les
quatre autres routes — `requireRole(["eleve","professeur"])`,
`requireConfiguredInstitution`, `handleApi`, refus traduit en `HttpError(403)`),
`api/_shared/code-vault-ent-actif-route.ts`, et deux scripts npm :
`test:code-vault-ent-actif-route` (contrat pur, sans base) et
`recipe:local-code-vault-ent-actif-route` (recette PostgreSQL réelle,
`--local-stack-only`).

Vérifié réellement dans cette session : `npm run test:code-vault-ent-actif-route`
→ 5/5 verts (validation du contrat pur : issues acceptées, champs inconnus
rejetés). Lecture du script de recette confirme qu'il exerce bien les deux
`reasonCode` distincts exigés par le plan (`ent_reset_failed`,
`ent_coordinate_incorrect`, tous deux routés vers `referent_numerique`) et
une preuve de non-rémanence (rollback vérifié).

**Non vérifié** : la recette PostgreSQL réelle elle-même
(`recipe:local-code-vault-ent-actif-route`) n'a pas pu être rejouée dans
cette session (Docker indisponible), et le commit du LOT 1 n'est accompagné
d'aucun compte rendu documentant qu'elle a été exécutée avec succès au
moment où elle a été écrite. Le code est réel et structurellement conforme
au reste du coffre ; son exécution de bout en bout contre une vraie base
reste une affirmation non étayée par une preuve écrite.

## LOT 2 — Recettes cassées : un bug corrigé et prouvé sans base, un bug non reproduit

Déjà documenté en détail par `SUITE-LOT2.md` (commit `69f3720`), relu dans
cette session, rien à y ajouter : le balayage littéral de
`recipe:local-code-vault-adversarial` était réellement cassé (confondait un
commentaire et un appel) et a été corrigé — prouvé par un script jetable
contre le contenu réel du dépôt, pas par une exécution de la recette
complète contre PostgreSQL. `recipe:local-code-vault-write-point` n'a montré
aucun défaut reproductible ; le fichier n'a pas été modifié. Les deux
recettes restent **non vérifiées de bout en bout contre PostgreSQL réel**,
faute de pile locale disponible — dans cette session comme dans celle du
LOT 2.

## LOT 3 — Requête HTTP réelle : écrit, jamais commité, jamais prouvé exécuté

`scripts/test-local-code-vault-http-routes.mjs` existe dans l'arbre de
travail (relu intégralement dans cette session) et couvre, en apparence, ce
que le plan demande : un vrai serveur `node:http` monté sur les cinq
handlers `export default`, méthode/en-tête/rôle/forme d'erreur pour les
cinq routes, la restriction structurelle « cantine exclut le professeur »,
un succès réel par route avec vérification d'écriture déclenchée par la
requête HTTP elle-même, et un balayage anti-fuite final sur toutes les
réponses capturées. `package.json` porte aussi le script npm correspondant
(`recipe:local-code-vault-http-routes`).

Mais :
- **`git status` montre ces deux fichiers comme non suivis** (`??`) : aucun
  commit ne les a jamais enregistrés. Le fichier ne référence lui-même aucun
  numéro de commit.
- **Aucun compte rendu** (`SUITE-LOT3.md` ou équivalent) n'existe.
- Le script exige `--local-stack-only` et une pile Supabase locale
  (`127.0.0.1:54321`/`54322`) : **impossible à exécuter dans cette session**
  (Docker indisponible, voir plus haut).

Conclusion honnête : le LOT 3 est **écrit mais pas passé**. Rien ne prouve
qu'il ait jamais été exécuté avec succès une seule fois. C'est très
probablement l'un des deux lots perdus que l'en-tête du plan anticipait
(« c'est ainsi que deux lots ont déjà été perdus ») — le travail existe sur
le disque mais la session qui l'a produit s'est arrêtée avant de le committer
et d'en rendre compte. Ce lot doit être repris intégralement par une future
session disposant d'un Docker fonctionnel : relire le script, l'exécuter, et
seulement alors le committer avec son compte rendu.

## LOT 4 — CLAUDE.md : fait et vérifié

Commit `8fb1997`, `SUITE-LOT4.md` déjà explicite. Reconfirmé dans cette
session : `CLAUDE.md` liste bien T071/T071A–T071F comme closes, T071G comme
seule ouverte sur ce domaine, T064 close avec sa preuve, T064A ouverte, et le
compte de 111 migrations. Rien à ajouter.

## T069 : NE PEUT PAS être cochée

T069 porte sur cinq parcours. Elle a **deux manques indépendants**, comme
annoncé par l'en-tête du plan :

1. **Le cinquième parcours (ENT actif) n'existait nulle part.** Ce plan y
   répond par du code réel (LOT 1), mais sans preuve d'exécution documentée
   contre une base réelle, et sans la preuve HTTP que le LOT 3 devait
   apporter (écrite mais jamais passée — voir plus haut). Ce manque est donc
   **réduit mais pas refermé avec une preuve complète**.
2. **L'absence de point de lecture/déchiffrement du coffre pour ce
   parcours** — en réalité sans objet ici : ce parcours ne remet aucun code
   (il guide une réinitialisation de mot de passe), donc n'a jamais eu besoin
   d'un tel point. Mais la décision humaine en attente sur le point de
   lecture du coffre en général (mentionnée par `CLAUDE.md`, T064A et les
   plans précédents) reste non prise, et ce plan avait explicitement pour
   consigne de ne pas y toucher.

Conclusion : **T069 reste `[ ]` dans `specs/002-agent-etablissement-adaptatif/tasks.md`**,
sans modification apportée à ce fichier par ce lot. Il ne serait pas honnête
de la cocher tant que (a) le LOT 3 n'a pas été rejoué et commité avec succès
et (b) qu'aucune preuve écrite de l'exécution réelle de la recette du LOT 1
n'existe.

## Contrôles finaux exécutés dans cette session

- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur.
- `npx vite build` → succès (`✓ built in 21.46s`), avertissement standard sur
  des chunks > 500 kB (`index`, `pdf`, `xlsx`), préexistant et sans rapport
  avec ce plan.
- `npm run test:preview-security-gate` → vert, tous les sous-tests listés
  passent (code sortie 0), y compris `test:migration-integrity` qui confirme
  `"migrations":111`.
- `npm run test:spec-integrity` → vert,
  `"002-agent-etablissement-adaptatif":{"completed":229,"open":71}`.

Aucun de ces quatre contrôles ne dépend de PostgreSQL ; ils ne compensent
donc pas l'absence de recette réelle pour les LOT 1/2/3 documentée plus haut.

## Ce qui reste, pour une future session

- Rejouer et committer le LOT 3 (`recipe:local-code-vault-http-routes`) dès
  qu'une pile Supabase locale est disponible.
- Rejouer `recipe:local-code-vault-ent-actif-route` (LOT 1) et
  `recipe:local-code-vault-write-point` /
  `recipe:local-code-vault-adversarial` (LOT 2) contre PostgreSQL réel, et
  écrire le compte rendu manquant du LOT 1.
- La décision humaine sur le point de lecture/déchiffrement général du
  coffre reste entière et hors du périmètre de ce plan.

## Périmètre respecté

Branche `codex/lycee-connect-prototype`, aucun `git push`, aucun drapeau
touché, aucune donnée réelle, aucun envoi, aucun déploiement, jamais
`~/Documents/LyceeGest-DONNEES-PRIVEES`, `decryptVaultCodeValue` jamais
appelé ni équivalent créé. Aucun agent en arrière-plan. Commit local unique
pour ce lot, limité à ce compte rendu. Les fichiers déjà présents dans
l'arbre de travail avant cette session et sans rapport avec ce lot
(`docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, `nuit.ps1`,
`package.json` modifié par le LOT 3 non commité, `.nuit-suite.lock`, les
autres `PLAN_*.md` non liés, `nuit-*.ps1`,
`scripts/test-local-code-vault-http-routes.mjs`) n'ont pas été touchés et ne
sont pas inclus dans ce commit — y compris le fichier LOT 3 lui-même, laissé
tel quel pour ne pas usurper une exécution/vérification qui n'a pas eu lieu
dans cette session.
