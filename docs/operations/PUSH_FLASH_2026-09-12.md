# Push et informations flash — 12 septembre 2026

Lot `002/T068A`, avec correction de `002/T071G`. Demande d’Adel : poursuivre le travail sur le poste et mettre en place push et notifications flash.

## Comportement livré

- Activation explicite dans l’espace personnel, dans Mes demandes et dans l’espace agent. Le téléphone peut autoriser les réponses et, séparément, les flashs importants. Désactivation depuis le même endroit.
- Sur iPhone/iPad, indication de l’installation sur l’écran d’accueil. La permission est demandée directement au clic. Aucun abonnement créé automatiquement par la visite du site.
- Les groupes de démonstration sont remplacés par les profils et classes de l’annuaire actif : élèves, parents/responsables, personnels, ou site public. Les classes parents/élèves sont distinctes. Une relation parent-enfant doit être valide et datée.
- Une correction crée une nouvelle version validée. La version publiée reste affichée jusqu’à publication explicite de la correction. Un numéro de version périmé est refusé. La publication remplace alors l’ancienne version sans modifier son texte historique.
- Une correction ne renvoie aucune alerte par défaut. La personne habilitée choisit explicitement. Un destinataire retiré qui avait réellement été notifié reçoit seulement un message générique de retrait. Une correction redevenue normale n’alerte pas un nouveau public.
- Chaque couple appareil/version est réservé une seule fois. Un résultat réseau incertain ne provoque pas de renvoi aveugle. Une réponse fournisseur 404/410 désactive l’abonnement.
- Le serveur recalcule le public depuis l’annuaire, l’établissement, les relations et les accès actifs. Les flashs privés sont servis uniquement dans l’espace identifié, avec expiration, recontrôle d’identité et absence de cache. Ils disparaissent du navigateur au changement d’accès ou à sa fermeture en arrière-plan.
- Le push affiche un texte générique ; aucun nom, classe, motif ou texte d’article sur l’écran verrouillé. Un clic ouvre la page prévue sans remplacer un brouillon d’administration déjà ouvert.

## Correctif technique confirmé

Le client Drizzle modifie les sérialiseurs du client PostgreSQL partagé. L’ancien `tx.json(subscription)` pouvait provoquer `ERR_INVALID_ARG_TYPE` avec un objet. L’API envoie désormais du JSON sérialisé explicitement, avec conversion SQL `::jsonb`. La route réelle est exercée dans la recette PostgreSQL.

La liaison des demandes à l’identité est calculée par l’API avec le secret existant et conservée sous forme d’empreinte opaque. Le worker n’a besoin d’aucun secret d’identité supplémentaire. Une empreinte saisie par le navigateur n’est jamais acceptée.

## Vérifications exécutées

- `npm run build` : réussi, avertissement préexistant sur la taille des bundles.
- `npm run test:preview-security-gate` : réussi.
- `npm run test:flash-recette` : réussi, dont six tests de contrat navigateur et de service worker.
- `scripts/test-isolated-support-push.mjs`, `test-isolated-flash-push.mjs`, `test-isolated-flash-routes.mjs` : PostgreSQL 16 jetable, via tunnel local strictement limité à `127.0.0.1:55446/push_recipe`. Migrations flash et push réelles. Frontière d’authentification fictive dans la recette des routes ; contrôles métier, requêtes SQL, verrous, versions, API push et flux privé réellement exécutés. Aucune personne réelle et aucun envoi extérieur.
- Chromium sur le site compilé, 1440 et 390 px : activation depuis un clic, retrait des flashs, désactivation, lecture du flash, choix des classes, aucun débordement ni erreur JavaScript. APIs et navigateur push simulés pour éviter tout envoi réel.
- Preuves locales hors dépôt : `Infos_personnelles_2026-09-12/push-flash/` et journaux `push-*-*.log` à la racine de l’espace de travail.

## Infrastructure

Projet vérifié : `safe-scol/lyceegest`, branche `codex/lycee-connect-prototype`, base pilote `xijocumlwivhbmffrnlj`.

Migrations additives appliquées par le connecteur Supabase : `school_flash_push` et `push_identity_binding`. Les versions horodatées dans l’historique distant sont attribuées par le connecteur ; les fichiers source sont `20260912004512_school_flash_push.sql` et `20260912085951_push_identity_binding.sql`.

`SUPPORT_FLASH_PUSH_ENABLED=true` ajouté uniquement à la Preview de cette branche. Le worker existant `/opt/lycee-support-preview/workers/support-push-worker.mjs` est raccordé au dispatch flash ; son timer reste réglé à une minute. Exécution distante vérifiée : `Result=success`, `ExecMainStatus=0`, aucune livraison faute d’abonnés. Retour arrière du worker et de sa configuration disponible dans `/opt/lycee-support-preview/.rollback-push-20260912` ; conserver les colonnes additives en cas de retour au précédent frontend.

Au contrôle précédant la livraison : zéro abonnement et zéro version flash. Aucun push, email ou SMS réel envoyé pendant cette intervention. Les confirmations de déploiement frontend sont ajoutées après la vérification du domaine public.

## Limites explicites et suite

- La réception physique d’un push reste à confirmer sur un téléphone réellement abonné, après autorisation de son propriétaire. La livraison au fournisseur ne prouve pas que le téléphone l’a affichée.
- Le module de communication des flashs est désactivé en base. Le pont existant peut préparer l’email lorsqu’il sera configuré ; ce lot n’active pas la diffusion email/SMS des flashs. Les faux contacts SMS ont été retirés de l’interface. La tâche globale T068 reste ouverte.
- Abonnements renouvelés à l’ouverture, durée maximale de 30 jours ; historique de livraison de 30 jours ; diffusion limitée aux publications autorisées depuis l’abonnement et aux dernières 24 heures. Une identité expirée ou un annuaire retiré interrompt les alertes privées.
- Les 78 fichiers historiques de l’ancien site restent à rescanner (`003/T009C`). Cette intervention ne les marque pas comme contrôlés.

Références techniques : [WebKit — Web Push sur iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [MDN — PushManager.subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe).
