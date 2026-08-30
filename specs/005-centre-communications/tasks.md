# Tâches - Centre de communication du lycée

## Phase 1 - Validation du fonctionnement

- [ ] T001 Valider les trois visibilités : public, interne et ciblé.
- [ ] T002 Confirmer les rôles autorisés à préparer, valider et envoyer.
- [ ] T003 Inventorier les groupes du Webmail sans importer les contacts dans Git.
- [ ] T004 Valider le texte d'information sur l'usage des emails personnels.

## Phase 2 - Données et règles

- [ ] T005 Ajouter les tables, contraintes, index, droits et audit.
- [ ] T006 Ajouter la file durable et les clés d'idempotence.
- [x] T007 Construire les validateurs de source, visibilité, audience et dates.
  Le contrat refuse les champs inconnus, les adresses dans l'audience, les
  groupes absents pour une cible, la publication web non publique et les dates
  incohérentes. Les groupes restent des références opaques à valider.
- [x] T008 Ajouter les interrupteurs globaux de publication et d'envoi. Les trois
  interrupteurs serveur sont désactivés par défaut et publication/envoi restent
  impossibles lorsque le module est coupé. Aucune variable Vercel n'est activée.

## Phase 3 - Préparation et publication

- [ ] T009 Ajouter l'entrée `Communications` dans l'espace administratif.
- [ ] T010 Construire le parcours `Déposer`, `Vérifier`, `Publier et informer`.
- [ ] T011 Extraire localement le texte des PDF et DOCX autorisés.
- [ ] T012 Étendre l'aide IA avec sortie structurée et informations à confirmer.
- [ ] T013 Ajouter les modèles Hebdo, Urgent, Rentrée, Document, Événement et Rappel.
- [ ] T014 Publier la version validée dans le flux daté du site.
- [ ] T015 Ajouter recherche, filtres, épinglage, expiration et archives publics.

## Phase 4 - Diffusion sécurisée

- [ ] T016 Définir le contrat serveur limité avec le registre du Webmail.
- [ ] T017 Préparer les destinataires par référence de contact, côté serveur.
- [ ] T018 Envoyer individuellement via Brevo avec lien canonique.
- [ ] T019 Enregistrer livré, différé, rejeté, spam et désinscrit.
- [ ] T020 Construire la boîte d'échec, la reprise et l'annulation des travaux.
- [ ] T021 Ajouter un aperçu email fidèle avant validation.

## Phase 5 - Entrants et réponses

- [ ] T022 Construire le webhook entrant authentifié et idempotent.
- [ ] T023 Rattacher chaque réponse à la bonne communication.
- [ ] T024 Classer retrait, correction de contact, question et réponse libre.
- [ ] T025 Créer un brouillon depuis un email transféré autorisé.
- [ ] T026 Configurer le domaine et le filtre Gmail uniquement après autorisation.

## Phase 6 - Validation

- [ ] T027 Tester qu'aucune adresse d'un autre destinataire n'est exposée.
- [ ] T028 Tester rôles, MFA, contenus internes et API publique.
- [ ] T029 Tester doublons, panne Brevo, reprise et 200 destinataires.
- [ ] T030 Vérifier PDF, image, DOCX, fichier invalide et données personnelles.
- [ ] T031 Vérifier 320 px, ordinateur, clavier et lecteur d'écran.
- [ ] T032 Déployer en preview et tester avec des contacts fictifs.
- [ ] T033 Faire valider le pilote avant toute liste réelle ou envoi collectif.
