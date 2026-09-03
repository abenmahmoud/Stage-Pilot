# Passation — Clôture nuit du 3 septembre 2026 (LOT 6 seul exécuté ce lot)

Branche `codex/lycee-connect-prototype`. Aucune action distante. Rien poussé.

## Périmètre réel de cette session

Seul le LOT 6 (clôture) du plan `docs/operations/NIGHT_PLAN_2026-09-03.md` a
été exécuté ici, sur instruction explicite. **Les LOT 2, 3, 4 et 5 n'ont pas
été lancés cette nuit** — ce ne sont pas des échecs, ce sont des tâches non
commencées. Ne pas lire ce document comme une preuve de bascule prête.

## Anomalie à signaler avant toute chose

La consigne reçue pour cette session affirmait : « le LOT 1 a échoué,
documente l'erreur exacte ». Vérification faite, **c'est contredit par les
preuves disponibles** :

- Le commit `8398b4a` (« docs(ops): compte rendu LOT 1 ») documente un LOT 1
  **réussi** : 94/94 migrations appliquées sans erreur SQL, jeu de données
  synthétique (`realData:false`), pile Supabase locale jetable.
- Recontrôle indépendant effectué dans cette session, sur la pile locale
  actuellement démarrée (conteneur `supabase_db_lyceegest-prototype`,
  démarré `2026-09-03T01:49:32Z`) :
  - `select count(*) from supabase_migrations.schema_migrations;` → **94**
  - fichiers dans `supabase/migrations/` → **94**
  - `to_regclass('public.site_content_items')` → la table existe
  - `npm run test:preview-security-gate` (inclut
    `test:migration-integrity`) → **94 migrations, 94 versions uniques**, gate
    au vert (exit code 0)

Aucune trace d'échec du LOT 1 n'a été trouvée. Je n'ai pas fabriqué d'erreur
pour correspondre à la consigne. Si un échec a réellement eu lieu (par
exemple avant le redémarrage de la pile constaté à 01:49:32Z), il n'est ni
documenté dans le dépôt ni observable maintenant : merci de préciser la
source de cette information si elle existe ailleurs (terminal non committé,
capture d'écran, etc.).

Point à surveiller quand même, déjà noté par le LOT 1 comme SUPPOSÉ non
bloquant : le conteneur `supabase_vector_lyceegest-prototype` redémarre en
boucle (`Restarting`) sur cette pile. N'affecte pas Postgres ni le résultat
des migrations, mais reste à vérifier explicitement avant de s'appuyer sur
les logs applicatifs de la pile locale.

## Ce qui est PROUVÉ cette nuit (LOT 1 + LOT 6)

- **LOT 1** (session précédente, `docs/operations/night-logs/LOT1.md`) :
  94 migrations rejouées sans erreur sur PostgreSQL local jetable, données
  100 % synthétiques.
- **LOT 6** (cette session) :
  - `npm run build` → succès, `dist/` généré, build en 9.41 s (avertissement
    non bloquant : plusieurs chunks JS dépassent 500 kB, optimisation possible
    hors périmètre de cette nuit).
  - `npm run test:preview-security-gate` → succès (exit code 0), toutes les
    sous-suites au vert (paiement de communications, confidentialité des
    sorties, client Webmail, intégrité des migrations : 94/94).
  - `npm run test:spec-integrity` → succès (exit code 0) :
    5 specs, 584 tâches recensées, dont `002-agent-etablissement-adaptatif`
    à 216 complétées / 55 ouvertes (`002/T010B4B` toujours ouverte, non
    cochée dans `specs/002-agent-etablissement-adaptatif/tasks.md:190`).
  - Drapeaux `IDENTITY_DEVICE_ACCESS_ENABLED` et
    `VITE_IDENTITY_DEVICE_ACCESS_ENABLED` : toujours à `false` dans
    `.env.local.example`.

## Ce qui est SUPPOSÉ

- Que le redémarrage en boucle de `supabase_vector` n'affecte rien de
  fonctionnel (hérité du LOT 1, non recontrôlé plus en profondeur ici).
- Que l'écart entre le `git status` untracked (`.claude/`, `CLAUDE.md`,
  `nuit.ps1`, `docs/operations/PLAN_GOUVERNANCE_2026-09-03.md`, et le plan
  de nuit lui-même) correspond à une mise en place volontaire de la
  gouvernance de cette nuit et non à un oubli — ces fichiers n'ont pas été
  ajoutés au commit de ce lot car ils ne sont pas un produit du LOT 6 ; ils
  restent en attente de décision du propriétaire.

## Go / no-go de la promotion production

**No-go implicite, faute d'exécution** : le LOT 2 (répétition de la
promotion 3 → 94 migrations, avec test du code de production `a9cf32e`
contre le schéma final) n'a pas eu lieu cette nuit. C'est le bloqueur
explicitement désigné par le plan (« LOT 2 — C'est LE bloqueur de la
bascule »). Sans ce lot, il n'y a aucune preuve locale que la promotion
réelle (3 migrations en production vers 94) se déroule sans casse sur le
code de production actuel. La cause connue du `500` en production (94
migrations en preview contre 3 en production) reste donc non résolue et non
testée.

## Liste ordonnée pour le propriétaire, vendredi matin

Dans l'ordre, avant toute bascule réelle :

1. **Lancer réellement le LOT 2** (répétition de la promotion 3 → 94 sur
   pile locale jetable) — condition bloquante non remplie cette nuit.
2. Lancer le LOT 3 (état exact des 28 contenus WordPress repris) pour savoir
   ce qui est publiable.
3. Lancer le LOT 4 (contrôles mécaniques : redirections, liens internes,
   responsive) et committer les corrections sûres qui en ressortent.
4. Lancer le LOT 5 (rédaction de la procédure de bascule datée du
   2026-09-04) une fois les LOT 2 à 4 terminés — un dossier de bascule
   rédigé sans les résultats de ces lots serait une procédure non fondée.
5. Clarifier l'anomalie ci-dessus sur le statut réel du LOT 1 : confirmer
   si un échec a eu lieu ailleurs que dans ce dépôt, ou acter que le LOT 1
   est bien réussi tel que documenté.
6. Statuer sur les fichiers non committés listés dans « Ce qui est
   SUPPOSÉ » : les committer, les ignorer explicitement, ou les supprimer
   selon l'intention réelle.
7. Ne toucher à aucune ressource distante (Vercel, Supabase production,
   DNS, Hostinger, Webmail) avant que les points 1 à 4 soient PROUVÉS, pas
   SUPPOSÉS.

## Commandes exécutées ce lot (traçabilité)

```
npm run build
npm run test:preview-security-gate
npm run test:spec-integrity
```

Toutes en exit code 0. Aucune commande distante, aucun `--linked`, aucun
`db push`, aucune URL de production utilisée.
