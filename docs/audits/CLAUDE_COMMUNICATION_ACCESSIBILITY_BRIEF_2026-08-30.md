# Brief d'audit Claude - accessibilité du centre de communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : aucun modèle Claude exact ni
plafond de consommation n'a été confirmé pour cette mission. Zéro jeton externe
a été consommé.

## Périmètre strict

- `src/pages/admin/CommunicationsPage.tsx`
- `scripts/test-communication-ui.mjs`
- `specs/005-centre-communications/tasks.md`, tâche T031A

## Mission proposée

Auditer en lecture seule la structure sémantique, les noms accessibles, les
états de chargement et sélection, l'ordre clavier, les groupes de boutons, les
formulaires et les cibles tactiles à 320 px. Rechercher en priorité les noms
dupliqués ou absents, les annonces trop bavardes, les associations invalides,
les contrôles invisibles au clavier et tout risque de débordement horizontal.
Ne pas modifier de fichier, variable, compte, donnée ou déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- scénario concret clavier, lecteur d'écran ou mobile ;
- correction minimale et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
