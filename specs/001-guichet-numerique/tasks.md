# Tâches ordonnées et vérifiables

## Règle de livraison

La V1 doit être utile sans IA. Chaque étape se termine par un commit, un build,
des tests et une vérification visuelle mobile/ordinateur. Aucun changement de
production n'est appliqué directement sans preview et sauvegarde.

État au 25 août 2026 : le socle API, les sessions, le suivi public, la file agent,
les messages et les pièces jointes sont branchés à une base Supabase de preview
isolée. Les workers VPS Brevo et ClamAV tournent chaque minute. Une demande, une
réponse, un email réel et un fichier sain déplacé vers le stockage privé ont été
validés de bout en bout. Les cases encore ouvertes comprennent soit une partie
restante, soit une configuration externe ou une validation par la direction.

## Jour 1 - Socle qui ne perd rien

- [x] **T001A** Corriger `get_role`, `set_updated_at`, les appels RLS par ligne et
  les index redondants sur la branche Supabase de preview.
- [ ] **T001B** Activer la protection des mots de passe compromis dans Supabase
  Auth et la confirmer avec un nouveau rapport des conseillers de sécurité.
- [x] **T002** Supprimer le détail brut des erreurs 500 renvoyé par l'API.
- [x] **T003** Ajouter la migration des tables support, index et contraintes, et
  restaurer dans Git les trois migrations historiques LyceeGest présentes dans
  le journal Supabase.
- [x] **T004** Créer les buckets privés `support-quarantine` et `support-clean`.
- [x] **T005** Écrire et tester les politiques RLS par rôle.
- [x] **T006** Créer `POST /api/support/requests` avec validation stricte,
  transaction et idempotence.
- [x] **T007** Créer l'échange jeton magique vers session HttpOnly, limiter les
  tentatives par réseau et faire vérifier uniquement l'adresse destinataire.
- [x] **T008** Créer `GET /api/support/requests/:code` limité à la session.
- [x] **T009** Créer le dépôt direct signé vers la quarantaine et sérialiser la
  réservation pour empêcher de dépasser cinq fichiers par concurrence.
- [x] **T010** Ajouter le journal append-only et les identifiants de corrélation.
- [ ] **T011** Ajouter tests unitaires, RLS et intégration de création concurrente.
- [x] **T012** Vérifier 200 créations, zéro perte et zéro doublon.
  Le script est désormais isolé par exécution, utilise une file temporaire,
  exige une cible preview explicite et nettoie ses données même après un échec.

### Sortie Jour 1

Un formulaire API peut créer, relire et suivre un vrai dossier avec fichiers en
quarantaine. Une panne d'envoi externe n'affecte pas le dossier.

## Jour 2 - Conversation et travail agent

- [x] **T013** Relier la conversation libre du prototype aux vraies API.
- [x] **T014** Ajouter la distinction demandeur/bénéficiaire et le contexte de
  chaque fichier.
- [ ] **T015** Ajouter IndexedDB pour brouillons et liste des dossiers du terminal.
- [x] **T016** Construire la page de suivi sécurisée et le fil de messages.
- [x] **T016A** Actualiser automatiquement le fil et permettre l'ajout de pièces
  jointes après la création du dossier.
- [x] **T016B** Afficher les trois niveaux de vérification, exiger le lien avec
  une liste officielle pour confirmer une identité et bloquer la résolution des
  demandes ENT ou email académique sans cette confirmation.
- [x] **T017** Construire la file agent paginée avec filtres, SLA et assignation.
- [ ] **T018** Ajouter réponses, notes internes, transfert et clôture motivée.
- [ ] **T019** Ajouter les modèles de réponse et variables autorisées.
- [x] **T020** Installer `pgmq`, la Basic Queue transactionnelle, le worker et la
  file d'échec administrable.
- [x] **T021** Implémenter l'envoi Brevo avec idempotence et `Reply-To` dossier.
  La file lie explicitement le destinataire et le jeton au même contact.
- [x] **T022** Recevoir les événements Brevo livré/rejeté/différé/spam.
- [ ] **T023** Configurer le domaine entrant Brevo et son webhook secret.
- [ ] **T024** Recevoir réponses et pièces jointes email dans le bon dossier.
- [ ] **T025** Ajouter tâches de rappel téléphonique et résultat d'appel.
- [ ] **T026** Tester les rejouements de webhooks et les pannes Brevo. La réception
  est maintenant atomique afin qu'une panne n'enregistre pas un reçu définitif
  avant le message et sa notification.

### Sortie Jour 2

Un parent peut créer une demande, recevoir l'email, répondre depuis sa boîte et
voir sa réponse dans le dossier. L'agent traite tout depuis une seule file.

## Jour 3 - Automatisation, PWA et exploitation

- [ ] **T027** Ajouter règles déterministes de classement, priorité et attribution.
- [ ] **T028** Ajouter détection et validation manuelle des doublons.
- [ ] **T029** Ajouter relances automatiques et surveillance des SLA.
- [x] **T030** Installer le worker antivirus VPS et le déplacement quarantine/clean.
- [ ] **T031** Mettre en place la sauvegarde chiffrée DB + Storage et un test de
  restauration.
- [x] **T032** Finaliser PWA : hors-ligne limité, mise à jour, icônes, installation.
- [ ] **T033** Ajouter notifications PWA pour les sessions actives.
- [ ] **T034** Ajouter tableau de santé, file d'échec et bouton de reprise.
- [ ] **T035** Ajouter le formulaire de collecte des emails personnels avec double
  vérification et validation agent.
- [x] **T036** Restaurer dans la navigation les formations et informations du lycée.
- [x] **T036A** Rendre le Webmail prioritaire et garder LyceeGest accessible depuis
  la navigation permanente et le catalogue des services.
- [x] **T036B** Remplacer les raccourcis Stages/Grand Oral de l'accueil par les
  besoins de rentrée : aide, inscription, classe, documents et codes d'accès.
- [x] **T036C** Faire du texte libre le parcours principal et conserver le
  formulaire classique comme option secondaire après la conversation.
- [x] **T036D** Mettre le nom Lycée Blaise Cendrars et le portrait avec cigarette
  au centre de l'identité visuelle de l'accueil.
- [x] **T036E** Présenter les huit spécialités générales avec photos, explications
  et compétences développées sur ordinateur et téléphone.
- [x] **T036F** Rendre le suivi appareil + email explicite, recommander l'email
  comme trace durable et conserver le téléphone comme secours.
- [x] **T036G** Recueillir la langue souhaitée et le besoin de rappel, adapter la
  réponse de l'assistant et rendre ces besoins visibles dans l'espace agent.
- [ ] **T036H** Reprendre et faire valider toutes les rubriques de l'ancien site
  selon `content-migration.md` avant toute bascule du domaine principal.
- [x] **T036I** Ajouter les premières pages détaillées STMG, STL, MELEC, PCEPC et
  CAP, ainsi que les accès CDI, UNSS, mini-stages et informations pratiques.
- [ ] **T037** Ajouter les mentions d'information, durées et procédure d'exercice
  des droits.
- [x] **T037A** Ajouter la page de confiance de préproduction, le contact DPO, les
  interdictions de partage de mots de passe et les protections HTTP du portail.
- [ ] **T038** Exécuter tests mobile, desktop, clavier, charge et sécurité.
- [x] **T038A** Relire les textes du parcours demandeur et agent, remplacer les
  codes internes par des libellés français et vérifier les principaux écrans.
- [x] **T038B** Vérifier le nouveau parcours d'aide sur ordinateur et téléphone,
  sans débordement horizontal et avec les aides de compréhension visibles.
- [ ] **T039** Déployer une preview Vercel protégée et la faire valider.
- [x] **T039A** Déployer la preview protégée et terminer sa validation technique
  mobile/ordinateur, API, base, email sortant et fichier sain.
- [ ] **T040** Basculer les DNS seulement après validation fonctionnelle.

### Sortie Jour 3

La V1 est installable, surveillée, sauvegardée et exploitable par la direction.
Le support continue à fonctionner si l'IA est coupée.

## Étape IA après décision sur la clé et validation DPO

- [x] **T041** Choisir OpenAI `gpt-5.6-luna` et confirmer la réutilisation de la
  clé existante pour l'aperçu protégé.
- [ ] **T042** Ajouter le pseudonymiseur et ses tests de non-fuite.
- [x] **T043** Définir le schéma de sortie classification/réponse/urgence/pièces.
- [x] **T044** Implémenter l'adaptateur IA serveur, `store: false`, avec repli local.
- [ ] **T045** Ajouter seuils de confiance et retour aux règles déterministes.
- [ ] **T046** Journaliser coût, durée, version et validation humaine.
- [ ] **T047** Tester les injections de consignes dans descriptions et fichiers.
- [x] **T048** Activer dans l'aperçu public protégé avec masquage préalable,
  limites de débit, aucune action sensible et validation humaine du dossier.

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
