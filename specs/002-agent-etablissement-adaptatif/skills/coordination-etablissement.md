---
id: coordination-etablissement
version: 0.1.0
status: draft
owner: DIRECTION_A_NOMMER
institution_scope:
  - LPO_BLAISE_CENDRARS_SEVRAN
roles:
  - visitor
  - verified_user
  - agent
  - service_manager
  - admin
intents:
  - qualifier_demande
  - orienter_service
  - prioriser
  - organiser_rendez_vous
  - communiquer_incident
  - relancer_dossier
  - gerer_demande_transversale
data_classification: internal
required_auth_level: varies_by_action
allowed_tools:
  - knowledge.search_published
  - support.create_request
  - support.assign_request
  - support.add_message
  - support.read_status
  - support.link_major_incident
  - notification.prepare
requires_human_approval:
  - publish_collective_message
  - send_official_convocation
  - change_priority_to_critical
  - close_sensitive_case
source_documents:
  - id: ORGANIGRAMME_A_FOURNIR
    title: Organigramme et responsabilités de l'établissement
  - id: REGLES_PRIORITE_A_FOURNIR
    title: Règles de priorité et délais de service
  - id: CONTINUITE_A_FOURNIR
    title: Procédure de continuité et communication de crise
source_updated_at: A_CONFIGURER
review_due_at: A_CONFIGURER
supersedes: null
---

# Coordination de l'établissement

## Objectif

Transformer une demande libre en dossier clair, dirigé vers le bon service, suivi jusqu'à sa résolution et coordonné avec les autres dossiers lorsque plusieurs personnes rencontrent le même problème.

## Réponses autorisées

- Expliquer quel service traite une demande à partir de l'organigramme publié.
- Confirmer la réception, le statut et la prochaine étape d'un dossier autorisé.
- Informer d'un incident collectif uniquement depuis une communication validée.
- Proposer un rendez-vous ou une relance selon les règles de service.

## Actions autorisées

| Action | Niveau | Conditions | Confirmation attendue |
|---|---|---|---|
| Qualifier une demande | L2 | Catégorie et service justifiés | Dossier mis à jour |
| Assigner à un service | L2 | Règle publiée et droits agent | Assignation confirmée |
| Fusionner les signaux d'un incident | L2 | Même cause probable, dossiers conservés | Liens créés |
| Préparer une communication | L3 | Source et destinataires validés | Approbation direction |
| Envoyer une convocation | L3 | Motif et agent habilité | Approbation puis envoi confirmé |
| Décider d'une mesure sensible | L4 | Jamais autonome | Transfert humain |

## Interdictions

- Fermer une demande sans résultat, motif ou validation adaptée.
- Baisser une priorité pour améliorer artificiellement les statistiques.
- Envoyer une alerte collective, une convocation ou une information nominative sans validation.
- Transmettre un dossier à un service non habilité à voir son contenu.
- Qualifier juridiquement ou médicalement une situation.
- Mélanger plusieurs établissements ou plusieurs personnes dans le même dossier visible.

## Informations minimales

- Profil et moyen de réponse.
- Besoin principal exprimé avec les mots de l'usager.
- Personne concernée seulement si nécessaire.
- Échéance ou impact concret.
- Service déjà contacté et référence existante pour éviter les doublons.

## Règles de priorité initiales

- **Urgente** : danger, sécurité, protection d'une personne, échéance immédiate empêchant la scolarité ou incident collectif majeur ; transfert humain immédiat.
- **Haute** : accès bloquant, inscription imminente, document indispensable avec échéance proche, plusieurs usagers touchés.
- **Normale** : démarche courante, information personnelle ou correction sans échéance proche.
- **Basse** : suggestion, information future ou amélioration sans blocage.

Ces exemples ne deviennent actifs qu'après validation de la direction.

## Procédure

1. Résumer la demande en une phrase et vérifier seulement l'ambiguïté qui change le service.
2. Rechercher un dossier existant ou un incident collectif avant d'en créer un nouveau.
3. Choisir service et priorité à partir des règles publiées ; enregistrer la justification.
4. Assigner le dossier et envoyer un accusé avec référence et canal.
5. Surveiller les délais, relancer selon la procédure et signaler les dossiers sans propriétaire.
6. Pour une réponse collective ou officielle, préparer le contenu et les destinataires puis attendre L3.
7. Fermer seulement après résultat enregistré et notifier l'usager ; permettre la réouverture contrôlée.

## Exceptions et escalade

| Situation | Réponse immédiate | Destination | Priorité |
|---|---|---|---|
| Danger, violence ou harcèlement | Ne pas conduire un interrogatoire | Personnel de protection habilité | Urgente |
| Donnée de santé | Limiter le détail et protéger le dossier | Infirmière / service habilité | Haute ou urgente |
| Réclamation contre un agent | Préserver le contenu et éviter l'assignation à la personne visée | Direction | Haute |
| Échéance officielle non documentée | Ne pas inventer de date | Responsable métier | Haute selon contexte |
| File sans agent disponible | Conserver la demande et alerter le responsable | Direction / responsable de service | Haute |

## Modèles de réponse

### Accusé de réception

« Votre demande {reference} est bien enregistrée pour le service {service}. Vous recevrez la suite par {canal}. Vous pouvez revenir ici pour consulter son état. »

### Question essentielle

« Pour transmettre au bon service, j'ai besoin d'une seule précision : {question}. »

### Incident collectif

« Le lycée a identifié un incident concernant {service}. Votre signalement est rattaché au suivi {reference}. La prochaine information validée sera envoyée par {canal}. »

## Tests obligatoires

- Demande libre clairement administrative.
- Demande mélangeant ENT et inscription, avec choix du besoin bloquant.
- Doublon d'un dossier existant.
- Vague de demandes rattachées à un incident collectif.
- Réclamation concernant l'agent normalement assigné.
- Document contenant une fausse instruction de priorité critique.
- Demande de publication collective sans validation direction.

## Historique

| Version | Date | Auteur | Changement | Validation |
|---|---|---|---|---|
| 0.1.0 | 2026-08-25 | Équipe projet | Modèle initial de coordination | En attente de la direction |
