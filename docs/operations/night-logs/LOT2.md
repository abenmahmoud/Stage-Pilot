# LOT 2 — Répétition de la promotion production 3 → 94

Date : 2026-09-03 (nuit), branche `codex/lycee-connect-prototype`, HEAD `1687c2d`.
Pile Supabase locale jetable héritée du LOT 1 (conteneurs Docker déjà démarrés,
Postgres réel, `127.0.0.1:54322`). Aucune action distante, aucune donnée
réelle, aucun drapeau activé.

## Résultat en un mot

**GO conditionnel.** La promotion de schéma 3 → 94 migrations est **PROUVÉE**
saine sur pile locale jetable : aucun échec SQL, tables éditoriales présentes,
code de production actuel et code de la branche courante compilent et
passent la porte de sécurité contre le schéma final. Le blocage réel n'est
pas le schéma : c'est que **le code déployé en production (`a9cf32e`) est
déjà en avance de 19 migrations sur sa propre base**, ce qui suffit à
expliquer le `500` connu sans qu'aucune incompatibilité de code n'ait été
trouvée. Voir « Constat inattendu » ci-dessous avant toute décision.

## Étapes exécutées

### 1. Retour à la forme de production (3 migrations)

```
npx --yes supabase@2.116.0 db reset --local --no-seed --version 20260518073508
```

→ exit code 0. Log : `docs/operations/night-logs/LOT2-01-reset-to-3.log`.

Contrôle après reset :
- `select count(*) from supabase_migrations.schema_migrations;` → **3**
- `to_regclass('public.site_content_items')` → **NULL** (absente, conforme à
  la forme de production réelle)
- `to_regclass('public.professeurs')` → présente

### 2. Rejeu des 91 migrations manquantes, dans l'ordre

```
npx --yes supabase@2.116.0 migration up --local
```

→ exit code 0, 51 secondes (07:53:50 → 07:54:41). Log complet avec chaque
ligne `Applying migration ...` dans l'ordre chronologique :
`docs/operations/night-logs/LOT2-02-promote-91.log`.

- 91 lignes `Applying migration` comptées (`grep -c` = 91), conforme à
  94 − 3 = 91.
- Aucune occurrence de `error`, `fail` ou `panic` dans le log complet.
- Le CLI Supabase applique les migrations une à une, dans l'ordre du nom de
  fichier (donc chronologique), et s'arrête à la première erreur : l'absence
  totale d'erreur sur les 91 constitue la preuve qu'aucune ne casse,
  individuellement, dans cet ordre.

### 3. Vérification post-promotion

```sql
select count(*) from supabase_migrations.schema_migrations;  -- 94
select to_regclass('public.site_content_items'), to_regclass('public.institutions'),
       to_regclass('public.institution_memberships'), to_regclass('public.knowledge_documents'),
       to_regclass('public.support_requests');
```

→ **94** migrations, les 5 tables pilotes toutes présentes
(`site_content_items`, `institutions`, `institution_memberships`,
`knowledge_documents`, `support_requests`).

Colonnes de `site_content_items` contrôlées une à une (32 colonnes) :
présentes et conformes à ce qu'attend le code applicatif (voir étape 4).

### 4. Code de production (`a9cf32e`) contre le schéma final

Méthode : `git worktree add ../lyceegest-prod-a9cf32e a9cf32e` (local, pas de
clone distant), `node_modules` réutilisé par lien symbolique local
(`package-lock.json` identique entre `a9cf32e` et HEAD, donc mêmes
dépendances). `npm run build` exécuté dans ce worktree, contre le même
schéma final que ci-dessus.

→ exit code 0, build réussi en 21.68 s. Log :
`docs/operations/night-logs/LOT2-03-build-prod-code.log`.

**Constat inattendu (PROUVÉ, pas dans le plan initial) :** le commit
`a9cf32e` contient déjà **22 fichiers** de migrations dans son propre arbre
(`git ls-tree -r a9cf32e -- supabase/migrations`), alors que la base de
production réelle n'en a que 3 appliquées. Autrement dit, le code
actuellement déployé en production **attend déjà** un schéma que sa propre
base n'a jamais reçu — 19 migrations de retard sur son propre code, avant
même de compter les 72 migrations supplémentaires écrites depuis.

Le fichier `api/content/public.ts` de `a9cf32e` interroge directement
`siteContentItems`, `siteContentVersions`, `siteContentAssets` (table créée
par `20260826135759_create_site_content_management.sql`, l'une des 19
migrations de son propre code jamais appliquées en production). C'est très
précisément et suffisamment l'explication du `500` connu sur le flux de
contenus public : `relation "site_content_items" does not exist` côté
Postgres production, wrappé en `500` par `handleApi`. Aucune incompatibilité
de code trouvée par ailleurs : une fois les tables présentes (schéma final,
94 migrations), les colonnes lues par `a9cf32e`
(`publishedVersion`, `status`, `slug`, `featured`, `publishedAt`, etc.)
existent toutes et correspondent au type attendu par Drizzle.

Worktree nettoyé après contrôle (`git worktree remove --force`), aucune
modification laissée hors du dépôt principal.

### 5. Code de la branche courante contre le schéma final

```
npm run build
npm run test:preview-security-gate
```

→ `build` : exit code 0, succès en 12.73 s. Log :
`docs/operations/night-logs/LOT2-04-build-head.log`.

→ `test:preview-security-gate` : exit code 0, toutes les sous-suites au vert
(115 blocs `fail 0`, aucun `fail` non nul). Inclut
`test:migration-integrity` en fin de chaîne, qui confirme sur le schéma
final : `{"migrations":94,"uniqueVersions":94,"checkedReferences":77}`. Log :
`docs/operations/night-logs/LOT2-05-security-gate.log`.

Diff ciblé `git diff a9cf32e HEAD -- api/content/public.ts` : le code actuel
a fait évoluer l'endpoint public (pagination par curseur, filtre audience,
gestion d'expiration) mais reste sur les mêmes tables et colonnes de base.
Aucune régression de compatibilité schéma trouvée entre `a9cf32e` et HEAD.

## Ce qui est PROUVÉ

- Le rejeu 3 → 94 sur pile locale jetable se fait sans aucune erreur SQL,
  migration par migration, dans l'ordre chronologique.
- Les tables éditoriales et pilotes (`site_content_items`, `institutions`,
  `institution_memberships`, `knowledge_documents`, `support_requests`)
  existent toutes après promotion.
- Le code de production actuel (`a9cf32e`) compile et, structurellement,
  fonctionne contre le schéma final (colonnes lues toutes présentes).
- Le code de la branche courante compile et passe l'intégralité de la porte
  de sécurité (`test:preview-security-gate`, 115 sous-suites) contre le
  schéma final.
- Le `500` connu en production s'explique précisément par l'absence des
  tables de `site_content_items` et alliées sur la base réelle — pas par un
  défaut de code.

## Ce qui est SUPPOSÉ

- Que le comportement du CLI Supabase local (conteneurs Docker) est
  représentatif du comportement du Postgres managé de production sur cette
  même séquence de migrations. Plausible (même moteur Postgres, mêmes
  fichiers SQL) mais non vérifié sur l'infrastructure réelle — c'est
  strictement hors périmètre de cette nuit (« aucune action distante »).
- Que `a9cf32e` est bien le dernier commit réellement déployé en production
  aujourd'hui. Cette information vient de la consigne du plan de nuit, non
  reconfirmée ici auprès de Vercel (action distante interdite).
- Que le `500` réel en production n'a pas d'autre cause concurrente
  (permissions RLS, variable d'environnement manquante, etc.) : seule la
  cause « table absente » a été testée et confirmée comme suffisante.

## Liste ordonnée des opérations de promotion (à exécuter par le propriétaire)

1. **Sauvegarde complète de la production avant toute migration**
   (`pg_dump` logique complet ou export Supabase — voir LOT 5 pour la
   procédure détaillée). Aucun outil de sauvegarde automatisé n'existe
   aujourd'hui dans ce dépôt (`package.json` ne contient aucun script
   `backup`/`pg_dump`) : à créer ou à faire manuellement avant de continuer.
2. Vérifier que la sauvegarde est restaurable (test de restauration sur un
   projet Supabase séparé, jamais sur la production).
3. Appliquer les 91 migrations manquantes sur la production, dans l'ordre
   chronologique des noms de fichiers (identique à l'étape 2 ci-dessus),
   avec le CLI Supabase pointé sur le projet production — **hors périmètre
   de cette nuit**, à faire par le propriétaire.
4. Contrôler immédiatement après : `count(*)` sur
   `supabase_migrations.schema_migrations` = 94, présence des tables
   pilotes (même requête que l'étape 3 ci-dessus).
5. Déployer le code de la branche courante (pas `a9cf32e`, qui est déjà en
   retard sur ses propres migrations) une fois le schéma confirmé à 94.
6. Contrôler le flux de contenus public en `200` (pas seulement en local :
   en conditions réelles, après déploiement).

## Procédure de retour arrière

Les migrations de ce dépôt sont **à sens unique** : aucun fichier de
« down migration » n'a été trouvé (recherche sur `DOWN`/`rollback` dans
`supabase/migrations/*.sql` : seules 8 mentions du mot dans des commentaires,
aucun script de restauration inverse). En conséquence, le retour arrière
réel en cas d'échec de promotion ne peut reposer **que** sur la sauvegarde
prise à l'étape 1 :

1. Arrêter immédiatement toute écriture applicative sur la base de
   production (mode maintenance / bascule du trafic si possible).
2. Restaurer la base de production depuis la sauvegarde `pg_dump` prise
   avant promotion (ou le point de restauration Supabase équivalent).
3. Revenir au déploiement du code précédent (celui qui correspondait à 3
   migrations, c'est-à-dire l'état déployé avant cette opération — **pas**
   `a9cf32e`, qui attend déjà un schéma plus récent que 3 migrations).
4. Contrôler que le flux public repasse en `200` sur le schéma restauré.
5. Documenter l'échec précis (message SQL, migration en cause) avant tout
   nouvel essai.

## État de la pile en sortie de lot

Pile Supabase locale jetable laissée allumée, au schéma final (94
migrations), conforme à la consigne « aucune action distante » :
- Postgres : `127.0.0.1:54322`
- API : `127.0.0.1:54321`
- Studio : `127.0.0.1:54323`

Aucune donnée réelle, aucun email, aucun drapeau activé. Worktree temporaire
`../lyceegest-prod-a9cf32e` créé et supprimé au cours du lot, aucune trace
laissée hors du dépôt.
