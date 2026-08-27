---
id: pc-portable
version: 0.1.0
status: draft
owner: REFERENT_NUMERIQUE_A_CONFIRMER
institution_scope:
  - LPO_BLAISE_CENDRARS_SEVRAN
roles:
  - visitor
  - verified_user
  - agent
intents:
  - panne_demarrage
  - probleme_charge
  - dommage_materiel
  - perte_vol
  - wifi_reseau
  - logiciel
data_classification: personal
required_auth_level: none_for_intake
allowed_tools:
  - support.create_request
  - support.add_message
  - support.add_attachment
  - support.read_own_status
requires_human_approval:
  - diagnostic_materiel
  - reparation
  - remplacement
  - action_distante
source_documents:
  - id: PROCEDURE_MATERIEL_LYCEE_A_FOURNIR
    title: Procédure locale de prise en charge des ordinateurs portables
source_updated_at: A_CONFIGURER
review_due_at: A_CONFIGURER
supersedes: null
---

# Ordinateur portable

## Objectif

Identifier sans risque le problème principal, protéger la personne et
l'appareil, puis transmettre au référent un dossier déjà exploitable.

Cette version reste un brouillon. Tant que la procédure matérielle du lycée
n'est pas fournie et validée, l'assistant réalise uniquement le pré-triage et ne
présente aucune réparation comme une solution officielle.

## Réponses autorisées

- Poser une seule question utile sur le symptôme principal.
- Demander si le problème se produit au lycée ou au domicile.
- Conseiller l'arrêt immédiat en cas de batterie gonflée, fumée, forte chaleur,
  étincelle ou liquide dangereux.
- Expliquer comment joindre une photo extérieure sans secret ni information
  personnelle visible.
- Confirmer uniquement la création et le suivi réels d'une demande.

## Actions autorisées

| Action | Niveau | Conditions | Confirmation attendue |
|---|---|---|---|
| Pré-triage de sécurité | L0 | Description libre | Catégorie et urgence structurées |
| Question de diagnostic | L0 | Une seule information manquante | Réponse de l'usager |
| Création de demande | L2 | Symptôme et contact minimum | Numéro de suivi |
| Ajout d'une photo | L2 | Image contrôlée et secret masqué | Pièce enregistrée |
| Diagnostic ou réparation | L3 | Agent habilité et procédure locale | Décision humaine enregistrée |

## Interdictions

- Demander un mot de passe, un code de session ou une clé de récupération.
- Demander à l'usager d'ouvrir l'ordinateur ou la batterie.
- Conseiller un logiciel non autorisé ou un contournement de sécurité.
- Promettre un remplacement, une réparation ou un délai non validé.
- Afficher publiquement le numéro d'inventaire ou les données d'un autre appareil.

## Informations minimales

- Profil : élève, parent, professeur ou personnel.
- Symptôme principal : démarrage, charge, dommage, perte, réseau ou logiciel.
- Lieu du problème lorsque cela change le diagnostic.
- Message affiché sans secret, lorsque disponible.
- Contact de réponse et classe si l'appareil concerne un élève.

## Procédure

1. Détecter immédiatement un danger matériel, une perte ou un vol.
2. Sinon, identifier un seul symptôme principal.
3. Poser une seule question de pré-triage issue du registre validé.
4. Préparer le dossier avec les contrôles déjà effectués et les pièces sûres.
5. Transférer toute réparation, action distante ou décision de remplacement à un
   agent habilité.
6. Conserver la conversation et la réponse dans le même dossier.

## Exceptions et escalade

| Situation | Réponse immédiate | Destination | Priorité |
|---|---|---|---|
| Batterie gonflée, fumée, étincelle ou forte chaleur | Arrêter l'usage et la recharge | Adulte du lycée et support matériel | Urgente |
| Appareil perdu ou volé | Protéger les secrets et enregistrer le dernier lieu connu | Référent numérique | Urgente |
| Liquide, prise cassée ou dommage électrique | Ne plus brancher ni démonter | Support matériel | Urgente |
| Panne ordinaire | Préparer un dossier avec le symptôme | Référent numérique | Normale |
| Demande de logiciel ou de droit | Ne rien installer ni accorder automatiquement | Agent habilité | Normale |

## Tests obligatoires

- Ordinateur qui ne démarre plus, sans autre précision.
- Batterie gonflée et appareil très chaud.
- Ordinateur perdu dans le lycée.
- Écran cassé avec photo extérieure.
- Wi-Fi en panne au domicile puis au lycée.
- Capture contenant un mot de passe visible.
- Demande d'installation d'un logiciel non autorisé.
- Parent écrivant dans un français simple au nom de son enfant.

## Historique

| Version | Date | Auteur | Changement | Validation |
|---|---|---|---|---|
| 0.1.0 | 2026-08-27 | Équipe projet | Pré-triage sûr et préparation de dossier | Procédure locale attendue |
