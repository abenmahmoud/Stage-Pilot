# LECTURE — LOT 4 : la recette adverse, avec un marqueur traqué partout

Date : 6 septembre 2026. Plan : `docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`,
section « LOT 4 — La recette adverse, avec un marqueur traqué partout ».
Tout le travail (lecture, écriture du script, exécution des recettes, et
rédaction de ce compte rendu) a eu lieu dans cette session, sans agent en
arrière-plan.

## Ce qui a été construit

`scripts/test-local-code-vault-lecture-adversarial.mjs` (nouveau), exposé par
`npm run recipe:local-code-vault-lecture-adversarial`
(`package.json`). Différence assumée avec les deux recettes adverses déjà
existantes pour le coffre (`test-local-code-vault-adversarial.mjs`, LOT 6 du
5 septembre ; `test-local-code-vault-branchement-adversarial.mjs`, LOT 6 du
branchement du 6 septembre) : celles-ci gardaient `CODE_VAULT_REVEAL_ENABLED`
fermé partout, pour prouver que rien ne fuit tant que le drapeau est fermé.
Ce script-ci **ouvre le drapeau**, mais uniquement dans l'objet `env` passé en
paramètre aux routes réelles (`handleEntInactifVaultRequest`,
`handleServiceDeliveryVaultRequest`) — jamais dans `process.env`, jamais dans
`.env.local.example` (resté à `false`, vérifié ci-dessous), jamais écrit sur
disque. C'est le paramètre `env?: NodeJS.ProcessEnv` que ces routes exposent
explicitement pour la recette locale. Sans l'ouvrir ainsi, la valeur ne serait
jamais réellement déchiffrée et la recette ne prouverait rien de plus que le
LOT 2 (drapeau fermé → jamais de lecture).

## Scénario exécuté

Pour chacun des trois parcours à code (ENT inactif, cantine, Koxo) : un code
fictif portant un marqueur unique (`LOT4-LECTURE-MARQUEUR-<uuid>-{ENT,CANTINE,KOXO}`)
est **écrit** (`writeVaultCodeValue`, point d'écriture réel), puis **remis**
(`recordVaultCodeDisplay`, appelé à l'intérieur de la route réelle, `outcome:
"displayed"`), puis **affiché** — c'est-à-dire réellement déchiffré et
renvoyé par `resolveVaultCodeReveal` (point de lecture réel, LOT 1/2 de ce
plan) dans l'objet `outcome.value` de la route, l'équivalent de la réponse
HTTP destinée à la personne. Les trois routes recettées sont les vraies
fonctions assemblées du LOT 3 de ce plan / LOT 3-4 du plan de branchement, pas
une réimplémentation.

## Balayage effectué, poste par poste (texte exact du plan)

- **`code_vault_access_events`** : les trois lignes `consult` insérées par le
  scénario sont relues et sérialisées ; aucun des trois marqueurs n'y
  apparaît (la table n'a structurellement aucune colonne valeur, vérifié ici
  par le contenu, pas seulement par le schéma).
- **`agent_skill_audit`** : table sans aucun rapport avec le coffre de codes
  (registre de compétences d'agent, plan OB1 du 5 septembre), balayée quand
  même — `summary::text`, `resource_type`, `action` — parce que le plan dit
  « partout », pas « partout où c'est plausible ». Zéro ligne trouvée pour
  les trois marqueurs.
- **Journaux applicatifs** : ce script n'écrit et ne provoque l'écriture
  d'aucun journal en dehors de sa propre sortie console. Le balayage de « la
  sortie capturée de tout le scénario » (voir plus bas) en tient donc lieu.
- **Réponses d'erreur** : une deuxième écriture volontaire sur l'attribution
  ENT déjà écrite (savepoint, annulé ensuite) déclenche une vraie violation
  de contrainte d'unicité Postgres, sanitisée par
  `shared/code-vault-pg-error.ts`. Le message et la sérialisation complète de
  l'erreur ne portent ni le marqueur déjà stocké, ni celui de la tentative
  rejetée ; `detail` (celui qui, au LOT 3 du 5 septembre, avait fuité la ligne
  en clair pour une contrainte CHECK) est absent de cette erreur-ci — la
  garantie du point d'écriture (jamais de `detail` brut) est confirmée sur ce
  chemin précis.
- **Métriques** : aucune table ni pipeline de métriques n'existe dans ce
  dépôt pour le coffre de codes. Constaté explicitement (champ
  `metricsMechanism` du JSON de sortie du script), pas contourné en silence :
  il n'y a rien à balayer parce qu'il n'y a rien qui existe.
- **Le contexte du modèle** : `buildModelVisibleVaultFact`, appelée pour
  chacun des trois services avec un accès accordé, ne porte jamais de champ
  `value`, et sa sérialisation JSON ne contient aucun des trois marqueurs.
- **La sortie capturée de tout le scénario** : `console.log`/`console.error`
  interceptés du début à la fin du script. L'objet `outcome` de chaque route
  (qui porte `value`) n'est **jamais** passé à `console.log` — seuls des
  booléens et des résumés le sont. Balayage final : aucune ligne capturée ne
  contient l'un des trois marqueurs.

Occurrence attendue, et seule occurrence trouvée : `outcome.value` dans la
mémoire du script, exactement égal au marqueur, pour les trois parcours
(`entOutcome.value`, `cantineOutcome.value`, `koxoOutcome.value`) — vérifié
par assertion, jamais journalisé.

## Preuves rejouées dans cette session, sur PostgreSQL réel local jetable

La pile locale (`127.0.0.1:54322`) tournait déjà à l'ouverture de la session.

- `node node_modules/typescript/bin/tsc --noEmit` → aucune erreur (dépôt
  entier, script du LOT 4 compris).
- `npm run recipe:local-code-vault-lecture-adversarial` (nouveau) →
  `{"target":"127.0.0.1:54322","assertions":29,"rollbackVerified":true,"realData":false,"revealFlagOpenedOnlyInLocalTestEnvObject":true,"metricsMechanism":{"present":false,...}}`.
- `npm run test:code-vault-read-point` → 7 tests, tous verts, garantie
  structurelle du point de lecture unique reconfirmée (aucun second lecteur
  dans `api/`, `shared/`, `workers/` — `scripts/` n'entre pas dans le
  périmètre de cette garantie, exactement comme pour les recettes adverses
  déjà existantes qui interrogent aussi directement
  `code_vault_private_rows`).
- `npm run test:code-vault-reveal-flag` → 7 tests, tous verts.

Toutes les transactions de la nouvelle recette confirment `rollbackVerified:
true` et `realData: false` : aucune ligne fictive, aucun établissement
fictif ne reste en base après exécution (vérifié par une connexion neuve
après l'annulation).

## Recette navigateur réelle

`npm run recipe:local-code-vault-secure-display-browser` (Chromium local,
rejouée fraîchement dans cette session, pas réutilisée d'une session
précédente) → 17 assertions, toutes vertes :

- la valeur fictive (`FICTIF-LOT6-9F3K-2QRT`) s'affiche dans un élément non
  éditable, ni dans le titre de la page, ni dans l'URL, ni dans un champ
  éditable ;
- le compte à rebours s'affiche au format attendu et **tourne réellement**
  (deuxième lecture différente de la première après 1,1 s) ;
- la copie réelle dans le presse-papier (`navigator.clipboard`) fonctionne ;
- après démontage du composant et 31 secondes d'attente (dépassant le délai
  d'effacement de 30 s), **le presse-papier est vide** — le minuteur
  d'effacement survit à la sortie de l'écran (correctif déjà posé, confirmé
  ici encore) ;
- aucune erreur console, aucun débordement horizontal ni bouton de copie
  sous 40 px à 320/390/1440 px.

Ce script (`test-code-vault-secure-display-browser-recette.mjs`) existait
déjà (LOT 6 du plan du coffre du 5 septembre, LOT 5 du branchement du
6 septembre) et couvre déjà exactement les quatre propriétés exigées par ce
LOT 4 (« le code fictif s'affiche, le compte à rebours tourne, la valeur
disparaît à l'expiration, le presse-papier s'efface »). Il n'a pas été
dupliqué : le composant qu'il exerce (`CodeVaultSecureDisplay`) n'a pas
changé depuis, et le rejouer suffit à en apporter une preuve fraîche pour
cette session, sans réutiliser une preuve d'une session antérieure comme
clôture de ce lot. Écart déjà documenté et non introduit par ce lot : ce
script sert le composant seul avec une valeur passée en prop, pas via une
route applicative — la page `CoffreEntInactifPage.tsx` ne monte pas encore ce
composant avec une valeur issue d'un vrai appel réseau au navigateur (aucun
serveur `api/vault/*.ts` réel démarré dans cette recette).

## Résultat du balayage adverse : aucune fuite trouvée

Aucune des trois occurrences fictives n'a été retrouvée ailleurs que dans
l'objet mémoire destiné à la personne (`outcome.value`) et dans le DOM du
composant (recette navigateur). C'est le résultat attendu par le plan : rien
à contourner, rien à corriger.

## Ce que ce lot ne couvre pas

- La recette navigateur n'exerce pas encore le trajet complet route réelle →
  réseau → composant : ce trou est antérieur à ce lot (documenté depuis le
  LOT 5 du branchement) et reste hors périmètre de ce LOT 4, qui portait sur
  le balayage anti-fuite du point de lecture, pas sur le câblage réseau
  navigateur.
- « Les métriques » : constat qu'aucun mécanisme n'existe, pas une preuve
  positive qu'un futur mécanisme serait sans fuite — à revérifier si un
  système de métriques est introduit plus tard pour le coffre.
- Les vérifications finales de clôture du plan (`vite build`,
  `test:preview-security-gate`, `test:spec-integrity`) sont réservées au
  LOT 5 et n'ont pas été rejouées ici, à l'exception de `tsc --noEmit`.

## Périmètre respecté

Branche `codex/lycee-connect-prototype`, aucun `git push`, aucun drapeau
activé dans une configuration réelle (`CODE_VAULT_REVEAL_ENABLED=false`
inchangé dans `.env.local.example`, vérifié ci-dessus), aucune donnée réelle,
aucun envoi, aucun déploiement, aucune lecture de
`~/Documents/LyceeGest-DONNEES-PRIVEES`. Aucun agent en arrière-plan : tout
le travail de ce lot (lecture des fichiers concernés, écriture du script,
exécution des deux recettes réelles, rédaction) a eu lieu dans cette session.
Le commit de ce lot ne porte que les trois fichiers explicitement listés :
`scripts/test-local-code-vault-lecture-adversarial.mjs`, `package.json`, et
ce compte rendu. Les fichiers modifiés ou créés par ailleurs dans l'arbre de
travail (`docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, `nuit.ps1`,
`.nuit-coffre.lock`, `.nuit-lecture.lock`,
`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`,
`docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md`, `nuit-coffre.ps1`,
`nuit-lecture.ps1`, `nuit-suite.ps1`) sont hors périmètre de ce lot et n'ont
pas été touchés par cette session.
