# Preuve preview - frontières adverses

## Périmètre

- Dépôt : `abenmahmoud/Stage-Pilot`
- Branche : `codex/lycee-connect-prototype`
- Environnement : code local et déploiement Vercel de preview uniquement
- Base : aucune migration et aucune donnée créée pour ce lot
- Production, DNS, Hostinger, VPS, Webmail, ENT et PRONOTE : non modifiés

## Contrôles réalisés

- 9 scénarios adverses dédiés réussis.
- 12 tests de politique d'identité réussis.
- 9 tests de périmètre des agents réussis.
- 12 tests de comportement sûr de l'agent réussis.
- 5 tests de sessions, liens et confirmation MFA réussis.
- Total : 47 contrôles ciblés, sans donnée réelle.
- Build TypeScript et Vite réussi.

## Garanties observées

- Une consigne de contournement ou une revendication de rôle ne produit aucune
  donnée scolaire et n'accorde aucune autorité.
- Un contact vérifié reste distinct d'une identité scolaire.
- Une relation parent-élève ne donne accès qu'à l'élève explicitement lié.
- Le suivi public est lié à une session, un code et un dossier précis.
- Chaque lecture ou écriture agent sur un dossier vérifie son service persistant.
- Les files, nombres et statistiques suivent le même périmètre de service.
- Les rôles sont lus dans les métadonnées serveur et la confirmation d'identité
  exige toujours MFA.

## Suite obligatoire

1. Exécuter T022A avec les scénarios complets de la charte et les réponses
   humaines attendues.
2. Rejouer la matrice à chaque changement d'authentification, de routage, de
   session ou de source de connaissance.
3. Réaliser une recette avec des comptes agents fictifs de chaque service avant
   toute ouverture pilote.
