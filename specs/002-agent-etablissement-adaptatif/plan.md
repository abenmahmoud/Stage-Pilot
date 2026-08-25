# Plan - Agent d'établissement adaptatif V2

## Décision d'architecture

La V2 étend le guichet numérique existant. Elle réutilise ses demandes, messages, pièces, statuts, notifications et traitements durables. Elle ajoute une couche d'orchestration, de connaissances et de contrôle ; elle ne crée pas un deuxième système de tickets.

## Composants

1. **Interface conversationnelle** : dialogue libre, dépôt de fichiers, suivi et formulaire de secours.
2. **Orchestrateur** : détermine l'intention, la compétence et la prochaine étape autorisée.
3. **Moteur de règles** : vérifie identité, rôle, niveau d'action, consentement et validation avant l'IA et avant chaque outil.
4. **Registre de compétences** : charge des documents versionnés propres à l'établissement.
5. **Base de connaissances** : ne recherche que dans les procédures et sources publiées, avec date d'expiration.
6. **Adaptateurs d'outils** : guichet numérique, LycéeGest, Webmail Lycée, Brevo, liens Scolarité Services et connecteur PRONOTE officiel lorsqu'il est autorisé.
7. **Boîte de validation** : permet à un agent habilité de contrôler une action L3.
8. **Journal et évaluation** : conserve les actions, sources, décisions, coûts et résultats de tests sans exposer les secrets.

## Flux de traitement

1. Recevoir le message et les fichiers.
2. Vérifier la taille, le type, l'antivirus et les limites de débit.
3. Déterminer le niveau d'identité disponible et masquer les données inutiles.
4. Appliquer les règles de sécurité et sélectionner les compétences autorisées.
5. Chercher dans les sources publiées de l'établissement.
6. Produire une réponse structurée ou préparer un appel d'outil.
7. Exécuter automatiquement L0 à L2 selon la règle ; placer L3 en validation ; transférer L4.
8. Enregistrer résultat, source, événements et notification dans le dossier existant.
9. N'affirmer la réussite qu'après retour confirmé de l'outil.

## Identité et niveaux d'accès

- **Visiteur** : informations publiques et création d'une demande.
- **Usager vérifié** : consultation de ses propres demandes et données autorisées.
- **Agent** : traitement des files de son service.
- **Responsable de service** : validation d'actions L3 et publication de procédures.
- **Administrateur** : configuration et habilitations, sans accès automatique au contenu hors de son périmètre.

L'accès usager pourra combiner jeton de suivi, code à usage unique par courriel/SMS et, plus tard, SSO officiel. L'espace agent exige un compte individuel et une authentification renforcée ; aucun mot de passe direction partagé en production.

## Données et fichiers

- Base relationnelle pour demandes, compétences, versions, sources, validations et audit.
- Stockage objet privé pour pièces jointes, avec analyse, métadonnées et URL temporaires.
- File durable pour classification, notifications, analyse documentaire et intégrations.
- Clé d'idempotence sur création, envoi et action externe.
- Sauvegardes testées et rétention configurée selon la catégorie.

## Stratégie IA

- Modèle rapide et économique pour classification, résumé et extraction structurée.
- Modèle plus capable uniquement pour les cas complexes autorisés.
- Sorties structurées validées par schéma ; aucun appel libre d'outil.
- Contexte composé de la compétence publiée, de courts extraits sourcés et du minimum de données du dossier.
- Budget et nombre de tours par session ; transfert propre après dix échanges.
- Jeu de tests versionné pour chaque compétence avant publication.

## Adaptation à un établissement

L'adaptation se fait sans modifier le code :

- identité, horaires, services, contacts et canaux de l'établissement ;
- procédures, dates, documents demandés et exceptions ;
- rôles habilités et niveaux de validation ;
- intégrations disponibles ;
- compétences activées et versions publiées.

Chaque ligne de données V2 porte un `institution_id`. Le premier déploiement reste mono-établissement tant que les politiques de cloisonnement n'ont pas été vérifiées.

## Déploiement proposé

- Interface et API légère sur Vercel, dans le projet LycéeGest concerné uniquement.
- Base, authentification et stockage privé dans l'environnement de données déjà choisi pour le projet.
- Traitements longs et files durables sur le VPS existant si les workers actuels répondent aux tests de reprise.
- Envoi de courriels par le service déjà configuré ; SMS uniquement après validation du besoin et du coût.
- OpenAI uniquement côté serveur, avec budget, journal des usages et aucun secret dans le navigateur.

## Déploiement progressif

### Étape A - Validation

- Confirmer les responsables de chaque service et les actions qu'ils autorisent.
- Inventorier la licence PRONOTE, son hébergement et les connecteurs disponibles.
- Valider données, durées de conservation et AIPD avec le DPO.

### Étape B - Socle sécurisé

- Registre de compétences, moteur de règles, sources datées, audit et banc de tests.
- Authentification individuelle des agents et boîte de validation.
- Réutilisation complète du suivi `001`.

### Étape C - Pilote rentrée

- Activer administration scolaire, référent numérique et coordination.
- Commencer avec procédures validées et imports limités.
- Mesurer classement, délais, transferts et corrections sur un groupe pilote.

### Étape D - Connecteurs officiels

- Ajouter PRONOTE après accord et test des droits.
- Ajouter SSO, calendrier, SMS ou signature seulement si leur valeur est démontrée.

## Vérification

- Tests unitaires des règles et schémas de sortie.
- Tests de chaque scénario positif, ambigu, interdit et expiré de chaque compétence.
- Tests d'autorisation croisée élève/parent/personnel/service/établissement.
- Test de 200 créations concurrentes et reprise après interruption d'un worker.
- Vérification mobile, ordinateur, PWA, clavier et lecteurs d'écran.
- Tests de prompt injection dans messages, documents et sources.
- Revue humaine de la qualité des réponses avant pilote réel.
