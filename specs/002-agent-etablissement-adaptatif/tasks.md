# Tâches - Agent d'établissement adaptatif V2

## Phase 0 - Décisions institutionnelles

- [ ] T001 Nommer un responsable métier pour secrétariat, vie scolaire, intendance, direction et numérique.
- [ ] T002 Inventorier les procédures, formulaires, calendriers, contacts et modèles de réponse réellement utilisés.
- [ ] T003 Vérifier licence, hébergement, ENT et connecteurs PRONOTE disponibles.
- [ ] T004 Classer les données et fixer leur durée de conservation avec le DPO.
- [ ] T005 Décider si une AIPD est nécessaire et enregistrer la décision.
- [ ] T006 Définir les actions L0 à L4 et les rôles habilités pour le lycée pilote.
- [ ] T007 Remplacer tout accès agent partagé par des comptes individuels avec authentification renforcée.
- [x] T007A Ajouter l’enrôlement TOTP, le défi à la connexion et l’exigence
  automatique pour chaque agent ayant déjà activé son second facteur, dans
  l’interface, les API et les politiques RLS de preview.
- [ ] T007B Créer au moins deux comptes nominatifs direction/administration,
  tester la procédure de récupération, puis activer l’obligation générale MFA
  dans l’interface et les API.

## Phase 1 - Socle de compétences

- [ ] T008 Créer les migrations `institutions`, adhésions, compétences, versions et sources.
- [ ] T009 Ajouter actions, validations, intégrations et évaluations avec politiques d'accès.
- [ ] T010 Ajouter `institution_id` et le niveau de vérification d'identité aux demandes `001` si nécessaire.
- [x] T010A Exposer dès le pilote les états coordonnées déclarées, contact vérifié
  et identité confirmée, avec un verrou sur les réponses contenant des codes.
- [ ] T011 Implémenter le parseur et le validateur du format de compétence.
- [ ] T012 Refuser la publication d'une compétence sans propriétaire, sources, révision et tests valides.
- [ ] T013 Construire l'écran de publication, désactivation et retour à une version précédente.
- [ ] T014 Construire le contrôle d'expiration des sources et compétences.

## Phase 2 - Autorité et sécurité

- [ ] T015 Implémenter le moteur déterministe identité-rôle-niveau-action avant le modèle.
- [ ] T016 Implémenter les listes blanches d'outils et schémas d'entrée par compétence.
- [ ] T017 Bloquer techniquement toute exécution L4.
- [ ] T018 Construire la boîte de validation L3 avec expiration, motif et audit.
- [ ] T019 Mettre les pièces dans un stockage privé avec antivirus, type, taille et URL temporaire.
- [ ] T020 Ajouter masquage des données, rétention, purge et journal d'accès.
- [ ] T021 Ajouter les limites de débit par appareil, compte, contact et comportement.
- [ ] T022 Tester injection de prompt, usurpation d'identité et accès croisé.

## Phase 3 - Agent et connaissances

- [ ] T023 Construire l'orchestrateur de compétences et les sorties structurées.
- [ ] T024 Construire la recherche limitée aux sources publiées, autorisées et non expirées.
- [ ] T025 Afficher source et date de mise à jour dans les réponses de procédure.
- [x] T026 Imposer une question essentielle à la fois et dix tours maximum par session.
- [ ] T027 Créer ou compléter automatiquement un dossier `001` lors d'un transfert humain.
- [ ] T028 N'afficher une réussite qu'après `confirmed_at` fourni par l'outil.
- [ ] T029 Ajouter formulaire classique et création de demande sans dépendance à l'IA.
- [ ] T030 Ajouter mesure du coût, de la latence, des transferts et des corrections.

## Phase 4 - Compétences du pilote

- [ ] T031 Faire valider et publier `administration-scolarite` avec les procédures locales.
- [ ] T032 Faire valider et publier `referent-numerique` avec l'annuaire d'escalade.
- [ ] T033 Faire valider et publier `coordination-etablissement` avec les règles d'urgence.
- [ ] T034 Ajouter inscription, pièces manquantes, certificat, bourse, orientation et rendez-vous.
- [ ] T035 Ajouter ENT, PRONOTE, messagerie académique, équipement et réseau.
- [ ] T036 Ajouter absence/justificatif, restauration, internat et demande libre.
- [ ] T037 Constituer au moins cinq tests positifs, trois ambigus et trois interdits par compétence.
- [ ] T038 Faire relire les réponses par chaque responsable métier.

## Phase 5 - Intégrations

- [ ] T039 Connecter le guichet `001` comme unique système de suivi.
- [ ] T040 Relier LycéeGest pour les stages par lien contextuel, sans duplication.
- [ ] T041 Ajouter les liens officiels Scolarité Services et PRONOTE.
- [ ] T042 Piloter les données locales avec imports limités, datés et révocables.
- [ ] T042A Importer la liste validée des professeurs et leurs emplois du temps,
  puis tester le rapprochement sans exposer l'annuaire au public.
- [ ] T043 Ajouter le connecteur ou export PRONOTE officiel après autorisation écrite.
- [ ] T044 Terminer les courriels entrants et sortants avec preuve de livraison disponible.
- [ ] T045 Ajouter SMS uniquement après validation du consentement, des usages et du budget.

## Phase 6 - Validation et mise en service

- [ ] T046 Exécuter le jeu de tests de toutes les versions publiées.
- [ ] T047 Tester 200 créations simultanées, reprise worker et idempotence des notifications.
- [ ] T048 Vérifier mobile 320 px, ordinateur, clavier, lecteur d'écran et installation PWA.
- [ ] T049 Exécuter une revue de sécurité et de protection des données.
- [ ] T050 Ouvrir un pilote limité avec agents nommés et canal de retour.
- [ ] T051 Mesurer deux semaines : classement, délai, transferts, corrections, coût et incidents.
- [ ] T052 Corriger les écarts puis exécuter `/speckit.analyze` et `/speckit.converge` avant généralisation.
