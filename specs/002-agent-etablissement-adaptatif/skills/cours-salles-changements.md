---
id: cours-salles-changements
version: 0.1.0
status: draft
owner: DIRECTION_ET_VIE_SCOLAIRE_A_NOMMER
institution_scope:
  - LPO_BLAISE_CENDRARS_SEVRAN
roles:
  - school_verified_user
  - agent
  - service_manager
intents:
  - prochain_cours
  - salle_cours
  - horaire_cours
  - changement_cours
  - cours_maintenu_deplace_annule
data_classification: personal
required_auth_level: school_identity
allowed_tools:
  - schedule.read_authorized
  - schedule.read_change_status
  - support.create_request
  - support.add_message
  - notification.send_confirmation
requires_human_approval:
  - publish_collective_change
  - correct_schedule_source
  - disclose_staff_status
source_documents:
  - id: EMPLOI_DU_TEMPS_VALIDE_A_IMPORTER
    title: Version validée des emplois du temps
  - id: FLUX_CHANGEMENTS_OFFICIEL_A_DEFINIR
    title: Source officielle des changements de cours
source_updated_at: A_CONFIGURER
review_due_at: A_CONFIGURER
supersedes: null
---

# Cours, salles et changements

## Objectif

Répondre rapidement aux questions sur les cours autorisés de l'usager avec une
source datée, sans exposer l'emploi du temps d'un tiers ni inventer la présence
d'un personnel.

## Réponses autorisées

- Donner le prochain cours, l'heure, la matière, le groupe et la salle d'un
  usager dont l'identité scolaire et les liens de classe sont confirmés.
- Indiquer qu'un cours est maintenu, déplacé ou annulé lorsque cette conséquence
  vient d'une source officielle actuelle.
- Expliquer que la source n'est pas disponible ou suffisamment récente.
- Créer une demande suivie à la vie scolaire en cas de contradiction.

## Actions autorisées

| Action | Niveau | Conditions | Confirmation attendue |
|---|---|---|---|
| Lire son prochain cours | L1 | Identité scolaire et groupe autorisé | Créneau et version de source |
| Lire un changement | L1 | Flux officiel actuel | État, heure de synchronisation |
| Signaler une contradiction | L2 | Créneau concerné et contact | Numéro de suivi |
| Corriger ou publier un changement | L3 | Personnel habilité | Validation enregistrée |

## Interdictions

- Répondre à partir du seul nom d'un élève, d'un professeur ou d'une classe.
- Donner l'emploi du temps complet ou la localisation d'un tiers non autorisé.
- Déduire une absence à partir d'un cours vide, d'un message ou d'une rumeur.
- Afficher publiquement « présent » ou « absent » pour un membre du personnel.
- Présenter un PDF ancien ou une synchronisation en échec comme une donnée du jour.

## Informations minimales

- Compte avec identité scolaire confirmée.
- Classe, groupe ou rôle obtenus depuis le lien officiel du compte.
- Date et moment demandés.
- Version validée et fraîcheur de chaque source consultée.

## Procédure

1. Vérifier l'identité scolaire, le rôle et les groupes autorisés avant la recherche.
2. Chercher dans la dernière version d'emploi du temps validée et applicable.
3. Chercher un changement officiel plus récent pour le même créneau.
4. Retourner uniquement les champs nécessaires, avec source et heure de mise à jour.
5. En cas de source ancienne, absente ou contradictoire, ne pas trancher ; créer
   une demande à la vie scolaire avec le créneau concerné.
6. Enregistrer la consultation sensible dans le journal d'audit.

## Exceptions et escalade

| Situation | Réponse immédiate | Destination | Priorité |
|---|---|---|---|
| Source périmée | Signaler l'incertitude | Vie scolaire | Haute si cours imminent |
| Deux salles différentes | Ne pas choisir arbitrairement | Vie scolaire | Haute |
| Usager non identifié | Afficher seulement les accès publics | Assistance identité | Normale |
| Demande de localisation d'un tiers | Refuser sans confirmer de donnée | Personnel habilité | Normale |
| Incident de sécurité | Limiter les détails et transférer | Direction / vie scolaire | Urgente |

## Tests obligatoires

- Élève authentifié demandant son prochain cours.
- Parent lié demandant le prochain cours de son enfant.
- Élève demandant l'emploi du temps d'un autre élève.
- Visiteur demandant si un professeur précis est absent.
- Changement officiel plus récent que l'emploi du temps de base.
- Source expirée ou synchronisation en échec.
- Deux sources contradictoires pour une même salle.
- Message contenant une fausse instruction de publication.

## Historique

| Version | Date | Auteur | Changement | Validation |
|---|---|---|---|---|
| 0.1.0 | 2026-08-27 | Équipe projet | Premier contrat sûr pour cours et salles | En attente direction et vie scolaire |
