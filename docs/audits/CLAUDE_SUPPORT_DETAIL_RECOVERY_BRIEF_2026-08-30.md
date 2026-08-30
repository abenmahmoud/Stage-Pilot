# Brief d'audit Claude - reprise du détail agent

## Mission préparée

Auditer la reprise d'un dossier après une panne ou une réponse invalide, sans
confusion avec la file, l'authentification ou une autre action agent.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-detail-recovery.mjs`

## Questions

1. Une réponse ancienne peut-elle remplacer la dernière tentative ?
2. Le bouton de reprise agit-il uniquement sur le dossier sélectionné ?
3. Les parcours connexion et MFA restent-ils prioritaires ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
