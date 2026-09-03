# Dossier de bascule — vendredi 4 septembre 2026

**Statut** : procédure écrite cette nuit (LOT 5), **aucune étape exécutée sur
une ressource distante**. Ce document ne remplace ni une autorisation écrite
de la direction, ni les décisions humaines listées dans
`docs/operations/BASCULE_SITE_ETAT_EDITORIAL_2026-09-03.md`.

Sources des preuves citées : `docs/operations/night-logs/LOT1.md`,
`docs/operations/night-logs/LOT2.md`, `docs/operations/night-logs/LOT3.md`,
`docs/operations/night-logs/LOT4.md`,
`docs/operations/SITE_PRODUCTION_CUTOVER_RUNBOOK.md`,
`docs/operations/LYCEEGEST_PRODUCTION_PROMOTION_READINESS_2026-09-02.md`,
`docs/operations/RECOVERY_ISOLATED_RESTORE_PREVIEW_2026-09-01.md`.

## Condition de départ (PROUVÉ cette nuit, à revérifier vendredi matin)

- Production réelle : `supabase_migrations.schema_migrations` = 3, code
  déployé = commit `a9cf32e` (qui attend en réalité 22 migrations dans son
  propre arbre Git — 19 jamais appliquées à sa base). C'est la cause du `500`
  connu sur le flux de contenus public (`site_content_items` absente).
- Répétition locale jetable (LOT 1 + LOT 2) : 3 → 94 migrations sans aucune
  erreur SQL ; `a9cf32e` et le code de la branche courante compilent tous les
  deux contre le schéma final ; `test:preview-security-gate` (115
  sous-suites) passe contre le schéma final.
- Éditorial (LOT 3) : **les 28 contenus WordPress repris sont non
  publiables aujourd'hui**, verrou T007 (vérification direction manquante)
  pour les 28, plus 3 blocages techniques (`contact` vide,
  `presentations-clubs` image cassée, `london-trip-review` PDF 49,8 Mo
  refusé) qui subsisteraient même après vérification. **Ce dossier ne couvre
  donc que la bascule technique (schéma + code + DNS) ; aucun contenu
  éditorial WordPress n'est prêt à être publié vendredi tel quel.**
- Mécanique (LOT 4) : 27 redirections cohérentes avec l'inventaire, 0 lien
  interne cassé sur 129 liens, contrat responsive automatisé au vert.
  Aucune vérification par rendu réel de navigateur (Playwright absent du
  dépôt) : à faire séparément, idéalement avant vendredi.
- Aucun script de sauvegarde (`pg_dump` ou export Supabase) n'existe dans
  `package.json` : l'étape 1 ci-dessous est donc manuelle, à la charge du
  propriétaire, tant qu'aucun outil n'est écrit.

## Vue d'ensemble : qui fait quoi

| Étape | Propriétaire seul (accès distant) | Automatisable localement (déjà écrit ou à écrire) |
| --- | --- | --- |
| 1. Sauvegarde production | Oui — Supabase Studio / CLI lié au projet réel | Non : aucun script dans ce dépôt |
| 2. Restauration test | Oui — nouveau projet Supabase isolé | Non |
| 3. Promotion du schéma | Oui — CLI Supabase pointé sur le projet production | Partiellement : la liste ordonnée des 91 migrations est déjà produite (LOT 2) |
| 4. Promotion du code | Oui — Vercel (alias de déploiement) | Non |
| 5. Contrôle flux public 200 | Le propriétaire déclenche la requête réelle | Oui : script de contrôle réutilisable (`recipe:public-pilot-smoke`, à pointer sur l'URL réelle) |
| 6. Contrôle des 27 redirections en ligne | Le propriétaire déclenche les requêtes réelles | Oui : liste des 27 routes déjà connue localement (`vercel.json`), seule l'exécution HTTP réelle est distante |
| 7. Bascule DNS / alias | Oui — panneau DNS Hostinger + alias Vercel | Non |
| 8. Contrôle post-bascule | Le propriétaire déclenche les requêtes réelles | Oui : mêmes scripts qu'à l'étape 5-6, rejoués après bascule |
| 9. Retour arrière | Oui — DNS + alias Vercel + restauration Supabase si nécessaire | Non (décision humaine + accès distant) |

## Procédure, dans l'ordre

### Étape 0 — Pré-requis avant d'ouvrir la fenêtre (durée : à faire en amont, pas le jour J)

- Action : autorisation écrite de la direction nommant la fenêtre, le commit
  candidat (pas `a9cf32e`), le projet Vercel et la base Supabase de
  production (voir `LYCEEGEST_PRODUCTION_PROMOTION_READINESS_2026-09-02.md`,
  « Portes obligatoires »).
- Action : décision humaine sur chacun des 28 contenus WordPress (publier /
  archiver / corriger), sinon la bascule ne doit porter que sur le code et le
  schéma, sans publication éditoriale.
- Contrôle de réussite : document d'autorisation signé conservé, matrice des
  28 décisions éditoriales renseignée.
- Retour arrière : sans objet (rien n'est encore engagé).
- Qui : propriétaire seul.

### Étape 1 — Sauvegarde de la production et vérification qu'elle est restaurable (durée estimée : 30–60 min)

1. Exporter la base Supabase de production (`pg_dump` complet ou export
   Supabase officiel) et faire un manifeste du Storage.
2. Restaurer cette sauvegarde dans un **projet Supabase séparé, isolé**
   (jamais sur la production). `RECOVERY_ISOLATED_RESTORE_PREVIEW_2026-09-01.md`
   documente une recette locale de restauration de paquet chiffré
   (`npm run test:recovery-sample-bundle`) : elle prouve le mécanisme sur des
   octets fictifs, **pas encore branchée sur un export réel de production** —
   à adapter, ou à défaut restauration manuelle via le tableau de bord
   Supabase.
3. Contrôle de réussite : la cible isolée démarre, `count(*)` sur
   `supabase_migrations.schema_migrations` = 3 (identique à la production
   actuelle), tables de base présentes.
4. Retour arrière : aucune action distante n'a encore eu lieu sur la
   production ; supprimer simplement le projet isolé de test en cas d'échec.
5. Qui : propriétaire seul (accès Supabase production requis).

### Étape 2 — Promotion du schéma, 3 → 94 (durée estimée : 5–10 min d'exécution, déjà mesurée à 51 s en local)

1. Sur la cible isolée restaurée à l'étape 1 (jamais directement sur la
   production tant que cette répétition n'est pas validée) :
   ```
   npx supabase@2.116.0 migration up
   ```
   (équivalent CLI de ce qui a été exécuté en local au LOT 2, log
   `docs/operations/night-logs/LOT2-02-promote-91.log`, 91 migrations
   appliquées dans l'ordre chronologique des noms de fichiers).
2. Contrôle de réussite :
   `select count(*) from supabase_migrations.schema_migrations;` = **94** ;
   présence de `site_content_items`, `institutions`,
   `institution_memberships`, `knowledge_documents`, `support_requests`
   (mêmes requêtes que LOT 2).
3. Une fois la cible isolée validée à 94, répéter l'opération **une seule
   fois** sur la production réelle, pendant la fenêtre de bascule.
4. Retour arrière : les migrations de ce dépôt sont à sens unique (aucune
   « down migration » trouvée — voir LOT 2). Le seul retour arrière possible
   après un échec de promotion est la restauration de la sauvegarde de
   l'étape 1. Ne jamais tenter une migration descendante improvisée.
5. Qui : propriétaire seul (CLI Supabase pointé sur le projet réel, jamais
   `--linked` ni `db push` depuis ce dépôt — interdit par `CLAUDE.md`).

### Étape 3 — Promotion du code (durée estimée : 5–10 min, déploiement Vercel)

1. Avant promotion : `npm run build` et `npm run test:preview-security-gate`
   sur le commit candidat, contre un schéma à 94 migrations (répété au LOT 2,
   exit code 0 sur les deux commandes — à rejouer sur le commit final réel
   avant de le déployer).
2. Déployer le commit candidat sur Vercel (pas `a9cf32e`, qui est déjà en
   retard de 19 migrations sur sa propre base et ne doit pas être redéployé
   tel quel).
3. Contrôle de réussite : déploiement Vercel `READY`, build sans erreur,
   variables d'environnement de production vérifiées (`IDENTITY_DEVICE_ACCESS_ENABLED`
   et `VITE_IDENTITY_DEVICE_ACCESS_ENABLED` doivent rester `false` tant que
   la tâche `002/T010B4B` n'est pas fermée).
4. Retour arrière : réaffecter l'alias Vercel au déploiement précédent
   (`dpl_41augagG39fL5gMXcud3WrWiZfQH`, commit `a9cf32e`) si le schéma reste
   compatible ; ne pas reconstruire depuis une branche mouvante.
5. Qui : propriétaire seul (accès Vercel).

### Étape 4 — Contrôle du flux de contenus public en 200 (durée estimée : 5 min)

1. Requête réelle sur l'endpoint public de contenu (`api/content/public`)
   après déploiement, sur l'URL de déploiement Vercel avant exposition du
   domaine principal.
2. Outil disponible localement à adapter à une cible réelle :
   `npm run recipe:public-pilot-smoke` (aujourd'hui prévu pour un
   environnement de preview local/jetable — à repointer explicitement sur
   l'URL de déploiement réelle avant de l'utiliser en production, ou à
   défaut requête manuelle).
3. Contrôle de réussite : `200`, contrat JSON valide, aucune `500`
   (`relation "site_content_items" does not exist"` ne doit plus apparaître).
4. Retour arrière : si `500` persiste, ne pas exposer le domaine principal ;
   revenir à l'étape 2 (contrôle du schéma) avant de retenter.
5. Qui : propriétaire déclenche la requête réelle ; le script de contrôle
   est réutilisable depuis ce dépôt une fois repointé.

### Étape 5 — Contrôle des 27 redirections en ligne (durée estimée : 10–15 min)

1. Liste des 27 routes déjà connue et vérifiée localement (LOT 3 + LOT 4,
   `vercel.json` ↔ `content/legacy-site/inventory.json`,
   `npm run test:legacy-routes` et `npm run test:legacy-coverage`, 6/6 tests
   au vert ce soir).
2. Sur l'URL de déploiement réelle (avant puis après exposition du domaine
   principal) : vérifier que chacune des 27 anciennes adresses
   `/<slug>` redirige vers `/site/<slug>` avec le bon code de statut.
3. Contrôle de réussite : 27/27 redirections répondent, aucune boucle,
   aucune erreur `4xx`/`5xx`.
4. Retour arrière : une redirection manquante en ligne alors que
   `vercel.json` la contient localement indique un problème de déploiement
   (pas de code) — vérifier le déploiement avant de suspecter le contenu.
5. Qui : propriétaire déclenche les requêtes réelles ; la liste de
   référence est déjà automatisée localement.

### Étape 6 — Bascule DNS ou d'alias (durée estimée : 5 min de changement + jusqu'à quelques heures de propagation DNS/TTL)

1. Relever les valeurs DNS actuelles et leur TTL avant tout changement
   (domaine principal → `147.79.112.49` Hostinger, `www` alias du domaine
   principal, `gestion.` déjà vers Vercel — voir
   `SITE_PRODUCTION_CUTOVER_RUNBOOK.md`).
2. Changer uniquement les enregistrements du domaine principal et `www` vers
   les valeurs indiquées par Vercel au moment de l'ajout du domaine. Ne
   toucher ni `mail`, ni `gestion`, ni aucun autre sous-domaine.
3. Contrôle de réussite : résolution DNS vers Vercel, certificat HTTPS émis
   et valide sur le domaine principal et `www`.
4. Retour arrière : remettre l'enregistrement principal à `147.79.112.49`
   et `www` en alias du domaine principal (valeurs du relevé de départ),
   sans supprimer le déploiement Vercel.
5. Qui : propriétaire seul (panneau DNS Hostinger).

### Étape 7 — Contrôle post-bascule (durée estimée : 30–60 min de surveillance active minimum)

1. Rejouer les étapes 4 et 5 (flux public `200`, 27 redirections) sur le
   **domaine principal** cette fois, pas seulement l'URL de déploiement
   Vercel.
2. Vérifier en plus : accueil, formations, documents, page Aide, connexion
   agent, en-têtes de sécurité (`npm run test:security-headers` donne le
   contrat local à revérifier en ligne), affichage mobile 320/390 px (audit
   statique fait au LOT 4, jamais vérifié en navigateur réel — à faire ici
   au minimum une fois, manuellement, faute d'outil de rendu dans ce dépôt).
3. Surveiller les erreurs `5xx`, la base et les files d'attente pendant
   toute la fenêtre annoncée (pas seulement au moment du contrôle initial).
4. Contrôle de réussite : tout ce qui précède au vert, aucune erreur `5xx`
   répétée observée pendant la fenêtre de surveillance.
5. Retour arrière : voir étape 8 si un critère de déclenchement est atteint.
6. Qui : deux personnes habilitées, une exécute, l'autre contrôle et note
   les preuves (règle du runbook existant).

### Étape 8 — Fenêtre et procédure de retour arrière (déclenchement : immédiat dès qu'un critère est atteint)

Déclencheurs : domaine ne répond pas, fonction prioritaire en échec,
authentification à risque, erreurs `5xx` répétées.

1. DNS : remettre l'enregistrement principal à `147.79.112.49`, `www` en
   alias, après vérification que ce sont bien les valeurs du relevé de
   l'étape 6.1 (durée : le temps de propagation DNS, quelques minutes à
   quelques heures selon TTL).
2. Ne pas supprimer le déploiement Vercel : le conserver pour analyse.
3. Si le code est en cause mais le schéma reste compatible : réaffecter
   l'alias Vercel au déploiement précédent connu bon
   (`dpl_41augagG39fL5gMXcud3WrWiZfQH`) sans toucher au schéma additif.
4. Si l'intégrité des données est en cause : couper les écritures
   applicatives, restaurer la base depuis la sauvegarde de l'étape 1 vers
   une **nouvelle cible isolée** (jamais directement sur la production
   active), valider cette cible, puis décider séparément d'un changement de
   connexion — cette dernière décision exige une nouvelle autorisation
   écrite.
5. Documenter l'heure, le symptôme, les journaux et les opérations
   réalisées.
6. Qui : propriétaire seul pour les actions distantes (DNS, Vercel,
   Supabase) ; documentation faisable par toute personne présente.

## Ce qui reste explicitement en dehors de ce dossier

- Aucune décision éditoriale n'est prise ici : les 28 contenus WordPress
  restent non publiables tant que T007 et les 3 blocages techniques ne sont
  pas levés par une décision humaine (voir LOT 3).
- Aucun script de sauvegarde/restauration de production n'existe encore
  dans ce dépôt : l'étape 1 dépend d'un outil Supabase officiel ou d'une
  procédure manuelle, pas d'une commande `npm run` de ce dépôt.
- Aucune vérification par rendu réel de navigateur (320/390/1440 px, erreurs
  console) n'a été faite cette nuit (LOT 4) : à faire avant ou pendant
  l'étape 7, faute de mieux.
