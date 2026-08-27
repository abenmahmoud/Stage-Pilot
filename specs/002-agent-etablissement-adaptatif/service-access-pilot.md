# Périmètres des agents du pilote

**Décision propriétaire** : 27 août 2026  
**État** : politique de preview implémentée, comptes nominatifs non créés

## Organisation retenue

| Espace | Rôle d'authentification | Services visibles | Transfert entre services |
|---|---|---|---|
| Superadministrateur | `superadmin` | Tous, y compris les demandes à classer | Oui |
| Direction | `proviseur` | Tous | Oui |
| Agent DDFPT | `agent` + `service_codes: [ddfpt]` | DDFPT uniquement | Non |
| Agent administration | `agent` + `service_codes: [secretariat, administration, intendance]` | Secrétariat, administration et intendance | Non |
| Agent vie scolaire | `agent` + `service_codes: [vie_scolaire]` | Vie scolaire uniquement | Non |

Le compte historique portant le rôle `administration` est limité au même
périmètre que l'agent administration. Il ne donne plus accès aux demandes
numériques, DDFPT, vie scolaire ou direction.

## Règles obligatoires

- Une demande sans service n'est visible que par le superadministrateur et la
  direction afin d'être classée.
- Un agent ne peut lire, prendre, modifier, commenter, répondre ou télécharger
  une pièce que dans son périmètre.
- Le contrôle est exécuté dans chaque API serveur. Le filtre de l'interface ne
  constitue jamais une autorisation.
- Seuls le superadministrateur et la direction transfèrent une demande entre
  services et enregistrent un modèle de réponse partagé.
- Un transfert retire l'ancien agent affecté mais conserve la conversation, les
  documents et le journal d'événements.
- Les demandes ENT ou email académique restent bloquées avant confirmation de
  l'identité dans une source officielle.
- Tous les agents utilisent un compte individuel et une double vérification.
  Aucun code partagé n'est accepté pour ce nouvel espace.

## Routage DDFPT

Le routage déterministe propose DDFPT pour les demandes mentionnant notamment
PFMP, convention ou recherche de stage, entreprise d'accueil, mini-stage,
plateau technique, atelier professionnel, voie professionnelle, MELEC ou PCEPC.
Un humain conserve la décision et peut corriger le service depuis la vue globale.

## Limite actuelle de la preview

La migration `institutions` et `institution_memberships`, les protections RLS
et le contrôle serveur sont prêts mais non appliqués à la base distante. Le
périmètre reste donc lu dans les métadonnées serveur signées jusqu'à l'activation
explicite du mode base de données. Il reste à appliquer la migration en preview,
tester quatre comptes fictifs, puis créer les comptes nominatifs autorisés.

## Données requises avant création des comptes

- nom et prénom de chaque agent ;
- adresse professionnelle individuelle ;
- service confirmé ;
- responsable autorisant l'accès ;
- second facteur enrôlé et procédure de récupération testée.
