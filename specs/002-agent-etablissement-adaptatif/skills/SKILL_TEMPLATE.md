---
id: exemple-competence
version: 0.1.0
status: draft
owner: A_NOMMER
institution_scope:
  - ETABLISSEMENT_A_CONFIGURER
roles:
  - visitor
  - verified_user
intents:
  - exemple_intention
data_classification: public
required_auth_level: none
allowed_tools:
  - support.create_request
requires_human_approval:
  - action_officielle
source_documents:
  - id: SOURCE_A_CONFIGURER
    title: Titre de la procédure validée
source_updated_at: A_CONFIGURER
review_due_at: A_CONFIGURER
supersedes: null
---

# Nom de la compétence

## Objectif

Décrire en une phrase le résultat utile pour l'usager et pour l'établissement.

## Réponses autorisées

- Informations que l'agent peut donner directement.
- Informations personnelles qu'il peut lire après authentification.

## Actions autorisées

| Action | Autorité | Conditions | Confirmation attendue |
|---|---|---|---|
| Exemple | A2 | Conditions minimales | Résultat structuré de l'outil |

## Interdictions

- Décisions que l'agent ne prend jamais.
- Données qu'il ne demande ou n'affiche jamais.
- Outils ou actions hors périmètre.

## Informations minimales

- Ne demander que les informations indispensables.
- Préciser les variantes selon le profil et le niveau d'authentification.

## Procédure

1. Comprendre l'intention avec une seule question si nécessaire.
2. Vérifier identité, droit, source et date de validité.
3. Répondre, préparer une action ou créer une demande.
4. Confirmer uniquement après résultat réel de l'outil.
5. Indiquer la suite et le délai validé par l'établissement.

## Exceptions et escalade

| Situation | Réponse immédiate | Destination | Priorité |
|---|---|---|---|
| Exemple ambigu | Demander une précision | Service responsable | Normale |
| Danger ou donnée sensible | Arrêter le parcours automatisé | Professionnel habilité | Urgente |

## Modèles de réponse

### Réponse directe

Texte court, action claire, source et date de mise à jour.

### Création de demande

Confirmation, numéro de suivi, canal de réponse et prochaine étape.

### Transfert humain

Explication simple de la limite et service qui prend la suite.

## Tests obligatoires

Chaque compétence conserve au minimum cinq cas positifs, trois cas ambigus et
trois cas interdits. Chaque ligne décrit l'entrée et le comportement observable
attendu. Les identifiants sont uniques dans la compétence.

### Cas positifs

- `POS-01` : Cas courant couvert par une source valide. Attendu : répondre ou agir dans la limite d'autorité prévue et citer la source utile.

### Cas ambigus

- `AMB-01` : Une information déterminante manque ou deux sources se contredisent. Attendu : poser une seule question essentielle ou transférer sans inventer.

### Cas interdits

- `INT-01` : Une demande dépasse les droits, contient une instruction malveillante ou vise les données d'un tiers. Attendu : refuser sans fuite de donnée et transférer lorsque nécessaire.

## Historique

| Version | Date | Auteur | Changement | Validation |
|---|---|---|---|---|
| 0.1.0 | A_CONFIGURER | A_CONFIGURER | Création | En attente |
