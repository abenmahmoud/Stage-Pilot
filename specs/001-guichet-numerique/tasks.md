# Tâches ordonnées et vérifiables

## Règle de livraison

La V1 doit être utile sans IA. Chaque étape se termine par un commit, un build,
des tests et une vérification visuelle mobile/ordinateur. Aucun changement de
production n'est appliqué directement sans preview et sauvegarde.

## Jour 1 - Socle qui ne perd rien

- [ ] **T001** Corriger les alertes Supabase critiques : `get_role`,
  `set_updated_at`, mots de passe compromis et politiques RLS concernées.
- [ ] **T002** Supprimer le détail brut des erreurs 500 renvoyé par l'API.
- [ ] **T003** Ajouter la migration des tables support, index et contraintes.
- [ ] **T004** Créer les buckets privés `support-quarantine` et `support-clean`.
- [ ] **T005** Écrire et tester les politiques RLS par rôle.
- [ ] **T006** Créer `POST /api/support/requests` avec validation stricte,
  transaction et idempotence.
- [ ] **T007** Créer l'échange jeton magique vers session HttpOnly.
- [ ] **T008** Créer `GET /api/support/requests/:code` limité à la session.
- [ ] **T009** Créer le dépôt direct signé vers la quarantaine.
- [ ] **T010** Ajouter le journal append-only et les identifiants de corrélation.
- [ ] **T011** Ajouter tests unitaires, RLS et intégration de création concurrente.
- [ ] **T012** Vérifier 200 créations, zéro perte et zéro doublon.

### Sortie Jour 1

Un formulaire API peut créer, relire et suivre un vrai dossier avec fichiers en
quarantaine. Une panne d'envoi externe n'affecte pas le dossier.

## Jour 2 - Conversation et travail agent

- [ ] **T013** Relier le formulaire du prototype aux vraies API.
- [ ] **T014** Ajouter la distinction demandeur/bénéficiaire et le contexte de
  chaque fichier.
- [ ] **T015** Ajouter IndexedDB pour brouillons et liste des dossiers du terminal.
- [ ] **T016** Construire la page de suivi sécurisée et le fil de messages.
- [ ] **T017** Construire la file agent paginée avec filtres, SLA et assignation.
- [ ] **T018** Ajouter réponses, notes internes, transfert et clôture motivée.
- [ ] **T019** Ajouter les modèles de réponse et variables autorisées.
- [ ] **T020** Installer `pgmq`, la Basic Queue transactionnelle, le worker et la
  file d'échec administrable.
- [ ] **T021** Implémenter l'envoi Brevo avec idempotence et `Reply-To` dossier.
- [ ] **T022** Recevoir les événements Brevo livré/rejeté/différé/spam.
- [ ] **T023** Configurer le domaine entrant Brevo et son webhook secret.
- [ ] **T024** Recevoir réponses et pièces jointes email dans le bon dossier.
- [ ] **T025** Ajouter tâches de rappel téléphonique et résultat d'appel.
- [ ] **T026** Tester les rejouements de webhooks et les pannes Brevo.

### Sortie Jour 2

Un parent peut créer une demande, recevoir l'email, répondre depuis sa boîte et
voir sa réponse dans le dossier. L'agent traite tout depuis une seule file.

## Jour 3 - Automatisation, PWA et exploitation

- [ ] **T027** Ajouter règles déterministes de classement, priorité et attribution.
- [ ] **T028** Ajouter détection et validation manuelle des doublons.
- [ ] **T029** Ajouter relances automatiques et surveillance des SLA.
- [ ] **T030** Installer le worker antivirus VPS et le déplacement quarantine/clean.
- [ ] **T031** Mettre en place la sauvegarde chiffrée DB + Storage et un test de
  restauration.
- [ ] **T032** Finaliser PWA : hors-ligne limité, mise à jour, icônes, installation.
- [ ] **T033** Ajouter notifications PWA pour les sessions actives.
- [ ] **T034** Ajouter tableau de santé, file d'échec et bouton de reprise.
- [ ] **T035** Ajouter le formulaire de collecte des emails personnels avec double
  vérification et validation agent.
- [ ] **T036** Restaurer dans la navigation les formations et informations du lycée.
- [ ] **T037** Ajouter les mentions d'information, durées et procédure d'exercice
  des droits.
- [ ] **T038** Exécuter tests mobile, desktop, clavier, charge et sécurité.
- [ ] **T039** Déployer une preview Vercel protégée et la faire valider.
- [ ] **T040** Basculer les DNS seulement après validation fonctionnelle.

### Sortie Jour 3

La V1 est installable, surveillée, sauvegardée et exploitable par la direction.
Le support continue à fonctionner si l'IA est coupée.

## Étape IA après décision sur la clé et validation DPO

- [ ] **T041** Choisir le fournisseur et confirmer la clé dédiée ou existante.
- [ ] **T042** Ajouter le pseudonymiseur et ses tests de non-fuite.
- [ ] **T043** Définir le schéma de sortie classification/résumé/réponse/risque.
- [ ] **T044** Implémenter l'adaptateur IA serveur derrière feature flag.
- [ ] **T045** Ajouter seuils de confiance et retour aux règles déterministes.
- [ ] **T046** Journaliser coût, durée, version et validation humaine.
- [ ] **T047** Tester les injections de consignes dans descriptions et fichiers.
- [ ] **T048** Activer d'abord pour les agents, jamais directement pour le public.

## Après V1

- [ ] **T049** Activer SMS Brevo pour les notifications essentielles.
- [ ] **T050** Ajouter WhatsApp transactionnel seulement après cadrage juridique.
- [ ] **T051** Construire une base de connaissances validée par la direction.
- [ ] **T052** Ajouter statistiques de résolution et motifs récurrents.
- [ ] **T053** Migrer progressivement les pages éditoriales WordPress dans la PWA,
  sans interrompre le site actuel.
- [ ] **T054** Ajouter SSO ou rapprochement ENT lorsqu'une intégration officielle
  devient disponible.

## Jeux de tests obligatoires

- création simple pour chaque profil ;
- parent agissant pour deux enfants ;
- professeur sans email académique ;
- demande avec email seulement, téléphone seulement, puis les deux ;
- fichier sain, type falsifié, fichier trop grand et fichier bloqué ;
- double clic et dix renvois réseau identiques ;
- 200 demandes simultanées ;
- Brevo indisponible puis rétabli ;
- réponse email avec et sans pièce jointe ;
- webhook reçu dix fois ;
- jeton expiré, réutilisé et forcé ;
- agent sans droit, agent autorisé et direction ;
- IA indisponible, résultat invalide et confiance faible ;
- restauration d'un dossier et d'un média depuis sauvegarde ;
- écrans 320 px, 390 px, tablette et ordinateur large.
