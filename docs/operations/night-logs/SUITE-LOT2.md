# SUITE — LOT 2 : réparer les deux recettes cassées

Plan : `docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md`, §LOT 2.
Portée stricte : les deux recettes nommées par le plan
(`recipe:local-code-vault-write-point`, `recipe:local-code-vault-adversarial`),
sans toucher à la sanitisation elle-même. Tout le travail (lecture,
diagnostic, correctif, rédaction) a eu lieu dans cette session, sans agent en
arrière-plan.

## Blocage d'environnement rencontré, documenté avant tout le reste

Docker Desktop était présent en processus (`Docker Desktop.exe` × plusieurs,
WSL `docker-desktop` à l'état `Running`) mais son moteur n'a **jamais**
répondu pendant cette session : `docker ps` a échoué en boucle avec
`failed to connect to the docker API at npipe:////./pipe/
dockerDesktopLinuxEngine` sur plus de neuf minutes d'attente répétée
(dix tentatives à 15 s, puis huit à 20 s, puis quinze à 20 s), revérifié une
dernière fois après tout le travail de ce lot — toujours en échec. Aucun
service PostgreSQL local alternatif n'est installé sur la machine (aucun
`postgres.exe`, aucun service Windows `postgresql-*`, aucun paquet
`pg-embedded`/`pglite` dans `node_modules`). Conséquence : **aucune des deux
recettes n'a pu être exécutée réellement contre PostgreSQL dans cette
session.** C'est le même blocage que celui déjà consigné dans `CLAUDE.md`
(« 94 migrations n'ont pas encore été rejouées sur un PostgreSQL réel »),
pas un fait nouveau. Je ne l'ai pas contourné en installant un PostgreSQL
alternatif dans WSL : ce serait une action d'infrastructure hors du
périmètre d'un seul lot, non validée par Adel.

Pour compenser l'absence de base réelle, chaque diagnostic ci-dessous a été
vérifié soit par lecture directe du code source exécuté (le pilote
`postgres`, `drizzle-orm`), soit par un script jetable isolé (créé, exécuté,
puis supprimé avant le commit — jamais commité) qui reproduit exactement le
chemin de code en cause sans avoir besoin d'une connexion réseau. Ce n'est
**pas** équivalent à la recette réelle sur PostgreSQL local : ça prouve que
le code fait ce qu'il est censé faire une fois qu'une vraie erreur Postgres
lui est présentée, pas que la recette complète (transaction réelle,
contraintes réelles, RLS réel) passe de bout en bout.

## `recipe:local-code-vault-adversarial` — bug confirmé et corrigé

### Diagnostic

Le script (`scripts/test-local-code-vault-adversarial.mjs`) contient un
balayage structurel (scénario 4, §LOT 6 du plan du 5 septembre) qui doit
prouver qu'aucun fichier de `api/` ou `workers/`, en dehors de la définition
elle-même (`api/_shared/code-vault-assignment.ts`), n'appelle
`traceManualVaultCodeReplacement`. Avant ce lot, ce balayage utilisait
`content.includes("traceManualVaultCodeReplacement")` — une simple
sous-chaîne, qui ne distingue pas un appel réel d'une mention en commentaire.

Deux commits antérieurs à ce lot (tous deux plus récents que la création de
ce script de recette, `bce1ed1`) ont introduit des commentaires qui
mentionnent ce nom de fonction sans jamais l'appeler :
- `api/_shared/code-vault-write.ts:35` (commit `58df6e5`, LOT 2 du plan de
  branchement du 6 septembre) ;
- `api/_shared/code-vault-ent-inactif-route.ts:53` (commit `71c0516`, LOT 3
  du même plan) : « Aucun remplacement pour ce lot
  (`traceManualVaultCodeReplacement` reste hors périmètre) : toujours la
  première version. »

Depuis l'introduction de ces deux commentaires, le balayage littéral
remonte ces deux fichiers comme de faux « appelants applicatifs », et
`check(applicationCallers, [], ...)` échoue — pas parce que la garantie
réelle (« aucune route ne déclenche de remplacement automatique ») est
fausse, mais parce que le test confond un commentaire et un appel.

### Correctif appliqué

Remplacé la sous-chaîne par un motif qui exige la forme syntaxique d'un
appel ou d'une déclaration — l'identifiant immédiatement suivi d'une
parenthèse ouvrante (`/traceManualVaultCodeReplacement\s*\(/`) — jamais
présente dans une mention en prose entre guillemets inverses. Commentaire
ajouté dans le script pour expliquer pourquoi (référence à ce lot, aux deux
fichiers concernés, à la distinction appel/mention).

**Aucune ligne applicative n'a été modifiée** : ni `code-vault-write.ts`, ni
`code-vault-ent-inactif-route.ts`, ni la garantie elle-même
(`traceManualVaultCodeReplacement` reste sans appelant applicatif réel). Seul
le balayage change, conformément à la consigne du plan (« ce n'est pas la
sanitisation qui est fausse »).

### Preuve obtenue, sans base

Un script jetable (créé et supprimé avant le commit, jamais commité) qui
reprend exactement la logique de balayage — ancienne (`includes`) et
nouvelle (regex) — a été exécuté contre le dépôt réel (`api/`, `workers/`) :

```
applicationCallers (fixed regex): []
applicationCallers (old naive includes, reproduces the bug): [
  '...\\api\\_shared\\code-vault-ent-inactif-route.ts',
  '...\\api\\_shared\\code-vault-write.ts'
]
```

Ceci confirme à la fois le bug (l'ancienne forme aurait fait échouer la
recette) et le correctif (la nouvelle forme retrouve `[]`, comme avant que
ces deux commentaires n'existent). C'est une preuve directe sur le contenu
réel du dépôt, pas une simulation de son contenu — mais ce n'est toujours
pas une exécution de la recette complète contre PostgreSQL (voir plus haut).

`node --check scripts/test-local-code-vault-adversarial.mjs` : syntaxe
valide. `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur sur
l'ensemble du dépôt.

**Non vérifié** : le reste de la recette (transactions réelles, RLS,
scénarios 1 à 9, balayage anti-fuite sur données réelles) n'a pas été
rejoué contre PostgreSQL dans cette session, faute de pile locale
disponible. Rien n'indique que ces autres scénarios soient cassés — le plan
ne mentionne qu'un seul défaut pour cette recette (« balayage littéral qui
confond un commentaire et un appel réel ») et c'est le seul trouvé par
lecture complète du script — mais je ne peux pas l'affirmer avec une preuve
d'exécution.

## `recipe:local-code-vault-write-point` — aucun bug reproduit, fichier non modifié

### Ce que le plan affirme

Le plan dit que cette recette échoue « sur la forme du message d'erreur
sanitisé, pas sur le fond », depuis le LOT 2 du plan de branchement (commit
`58df6e5`, qui a changé `writeVaultCodeValue` pour qu'il attrape toute
erreur Postgres et relance une `SanitizedPgWriteError` — message et nom de
contrainte seulement, jamais `detail`, jamais de `cause`).

### Ce que la lecture du script montre

`scripts/test-local-code-vault-write-point.mjs` n'a plus été modifié depuis
sa création (commit `295a904`, avant la sanitisation). Son seul point de
contact avec la forme d'une erreur Postgres est la vérification du rejet
d'une deuxième écriture sur la même attribution (une vraie violation de
contrainte d'unicité) :

```js
(error) =>
  (error?.cause?.message ?? error?.message ?? String(error)).includes(
    "duplicate key value violates unique constraint"
  )
```

### Vérification effectuée, sans base

Un script jetable (créé et supprimé avant le commit) a appelé
`writeVaultCodeValue` réel avec une transaction fictive dont `execute` lève
une erreur fabriquée dans la forme exacte d'une vraie `PostgresError` du
paquet `postgres` (mêmes champs que `node_modules/postgres/src/errors.js` :
`message`, `detail`, `constraint_name`, tous copiés sur l'instance via
`Object.assign(this, x)` après `super(x.message)` — vérifié par lecture du
paquet, pas supposé). Résultat :

```
name: SanitizedPgWriteError
message: duplicate key value violates unique constraint "code_vault_private_rows_assignment_id_institution_id_key"
cause: undefined
has detail: false undefined
computed text: duplicate key value violates unique constraint "..."
includes check: true
```

Le `message` sanitisé garde le texte brut du champ `message` de Postgres
(seul `detail` est jeté par `sanitizePgError` — vérifié dans
`shared/code-vault-pg-error.ts`), donc l'assertion de cette recette
continue de trouver la sous-chaîne attendue. Avec le code actuellement dans
le dépôt, **je n'ai pas réussi à reproduire l'échec que le plan décrit**
pour cette recette précise.

### Décision : ne pas modifier ce fichier

Faute de bug reproduit, et pour respecter la consigne du plan (« ne modifie
pas la sanitisation pour faire passer un test : c'est l'attente du test qui
est périmée, pas le comportement » — qui suppose qu'il y a une attente
précise à corriger), je n'ai touché à rien dans
`scripts/test-local-code-vault-write-point.mjs`. Modifier ce fichier sans
avoir identifié un vrai défaut aurait été une correction au hasard, contraire
à l'esprit de la consigne.

**Non vérifié, et à traiter en priorité par la prochaine session qui aura
accès à Docker** : je n'ai pas pu exécuter cette recette contre PostgreSQL
réel. Il reste possible qu'un défaut existe ailleurs dans ce script (par
exemple dans l'écriture initiale dans `institutions` ou
`code_vault_assignments`, ou dans une interaction avec le point de sauvegarde
`savepoint`/`rollback to savepoint` qu'une transaction fictive ne peut pas
reproduire) qui ne se manifeste qu'en présence d'un vrai serveur Postgres.
Si la prochaine session rejoue `npm run recipe:local-code-vault-write-point`
et la trouve encore cassée, ce compte rendu montre déjà où chercher (et où
ne pas chercher : le point de contact avec l'erreur sanitisée, vérifié
sain ci-dessus).

## Fichiers touchés par ce lot

- `scripts/test-local-code-vault-adversarial.mjs` (corrigé).
- Ce compte rendu.

Aucun autre fichier du dépôt n'a été modifié. Les scripts de diagnostic
jetables créés pendant l'investigation (`scripts/_diag_tmp.mjs`,
`scripts/_diag_scan_tmp.mjs`) ont été supprimés avant ce commit et ne
figurent pas dedans.

## Périmètre respecté

Branche `codex/lycee-connect-prototype`, aucun `git push`, aucun drapeau
activé, aucune donnée réelle, aucun envoi, aucun déploiement, aucune lecture
de `~/Documents/LyceeGest-DONNEES-PRIVEES`, jamais `decryptVaultCodeValue`
appelé ni équivalent créé. Aucun agent en arrière-plan : tout le travail de
ce lot (lecture, diagnostic par scripts jetables, correctif, rédaction) a eu
lieu dans cette session. Commit local unique pour ce lot, avec chemins
explicites, limité aux deux fichiers listés ci-dessus. Les fichiers déjà
présents dans l'arbre de travail avant cette session et sans rapport avec ce
lot (`docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, `nuit.ps1`,
`.nuit-suite.lock`, `docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`,
`docs/operations/PLAN_DONNEES_REELLES_2026-09-06.md`,
`docs/operations/PLAN_ENT_ACTIF_ET_DETTE_2026-09-06.md`,
`docs/operations/PLAN_IMPORT_UTILISABLE_2026-09-07.md`,
`docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`, `nuit-coffre.ps1`,
`nuit-edt.ps1`, `nuit-lecture.ps1`, `nuit-suite.ps1`) n'ont pas été touchés
et ne sont pas inclus dans ce commit.
