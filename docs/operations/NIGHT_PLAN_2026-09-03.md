# Plan de nuit — 3 septembre 2026 : bascule du site du lycée vendredi

OBJECTIF : que vendredi, le site du lycée devienne ce site. Tout le travail de
cette nuit sert cette bascule. Les améliorations viendront après la mise en
ligne, par progressions successives.

Contexte vérifié : Docker répond (29.3.1). Preview à 94 migrations, production
à 3 — c'est la cause connue du `500` sur le flux de contenus public en
production. Branche `codex/lycee-connect-prototype`.

Règles pour TOUS les lots (en plus de `CLAUDE.md`) :
- Aucune action distante cette nuit : ni DNS, ni Vercel, ni Supabase distant,
  ni Hostinger, ni email. La barrière `.claude/hooks/deny-remote.ps1` bloque ;
  ne la contourne jamais. Tout se prépare en local pour être exécuté demain par
  le propriétaire.
- Commit local après chaque lot. Ne jamais pousser.
- Distingue PROUVÉ / SUPPOSÉ / À FAIRE PAR LE PROPRIÉTAIRE.
- N'invente aucun contenu éditorial et ne publie rien.

---

## LOT 1 — Rejeu des 94 migrations sur PostgreSQL jetable

1. `docker info`
2. `npm run test:local-production-shape-migration-safety`
3. `npx --yes supabase@2.116.0 start`
4. `npm run recipe:local-production-shape-migration`
5. Relève migrations appliquées, échecs, durée. Laisse la pile allumée.

Fini quand : les 94 migrations passent, ou l'erreur exacte est documentée.

## LOT 2 — Répétition de la promotion production 3 → 94

C'est LE bloqueur de la bascule. Sur la pile locale uniquement :
1. Pars d'une base ne contenant que les 3 migrations de production.
2. Applique les 91 versions manquantes dans l'ordre, en relevant chaque échec.
3. Vérifie que `site_content_items` et les tables éditoriales existent ensuite.
4. Teste le code de production actuel (commit `a9cf32e`) contre le schéma final,
   puis le code de la branche courante. Note ce qui casse, précisément.
5. `npm run build` + `npm run test:preview-security-gate` sur le schéma final.

Fini quand : un avis go / no-go écrit, la liste ordonnée des opérations de
promotion, et la procédure de retour arrière. Aucune action sur la vraie
production.

## LOT 3 — État exact de la reprise éditoriale

Inventorie ce qui est réellement prêt à être publié parmi les 28 contenus
WordPress repris, en lisant le dépôt et non les cases cochées.

Produis `docs/operations/BASCULE_SITE_ETAT_EDITORIAL_2026-09-03.md` :
- les 28 contenus, un par ligne : slug, destination, état, publiable ou non ;
- les bloqueurs connus : page Contact vide, image locale cassée des clubs,
  PDF du voyage à Londres de 49,8 Mo, deux DOCX refusés ;
- les corrections mécaniques déjà préparées (T017B) et leur état ;
- les 27 redirections d'anciennes adresses et leur couverture ;
- pour chaque contenu non publiable : la décision humaine exacte attendue.

## LOT 4 — Tout ce qui est mécanique et sûr, fait maintenant

Sans rien publier et sans toucher au distant :
1. Rejoue le contrôle des 27 redirections contre l'inventaire.
2. Contrôle les liens internes des brouillons repris.
3. Contrôle responsive 320, 390 et 1 440 px des pages publiques (accueil, À la
   une, Vie du lycée, page éditoriale, Services, Aide, Suivi, Confidentialité) :
   aucun débordement, aucune erreur console.
4. Corrige uniquement ce qui est certain et non éditorial, avec un test.

Fini quand : chaque contrôle a un résultat écrit et les corrections sûres sont
committées.

## LOT 5 — Dossier de bascule pour vendredi

Écris `docs/operations/BASCULE_SITE_VENDREDI_2026-09-04.md` : la procédure
exacte, dans l'ordre, avec pour chaque étape la commande ou l'action, le
contrôle de réussite, et le retour arrière.

Couvre au minimum : sauvegarde de la production et vérification qu'elle est
restaurable · promotion du schéma · promotion du code · contrôle du flux public
en `200` · contrôle des 27 redirections en ligne · bascule DNS ou d'alias ·
contrôle post-bascule · fenêtre et procédure de retour arrière.

Sépare clairement : ce que le propriétaire seul peut faire (DNS, Hostinger,
Vercel, Supabase production) et ce qui est automatisable. Indique la durée
estimée de chaque étape.

## LOT 6 — Clôture (toujours exécutée)

1. `npm run build`
2. `npm run test:preview-security-gate`
3. `npm run test:spec-integrity`
4. Écris `docs/operations/CLAUDE_HANDOFF_BASCULE_2026-09-03.md` : ce qui est
   prouvé cette nuit, le go / no-go de la promotion, et la liste ordonnée de ce
   que le propriétaire doit faire vendredi matin.
5. Commit local. Ne pousse pas.