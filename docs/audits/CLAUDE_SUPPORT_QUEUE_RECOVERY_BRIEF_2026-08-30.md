# Brief d'audit Claude - reprise de la file agent

## Mission proposée

Auditer uniquement la reprise manuelle après échec de chargement de la file.
Vérifier qu'une erreur d'authentification ne peut pas être contournée, qu'une
erreur métier n'affiche pas un bouton hors sujet et qu'un succès retire l'alerte.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `src/pages/prototype/lycee-connect.css`
- `scripts/test-support-queue-recovery.mjs`

## Sortie attendue

Constats classés par gravité avec scénario reproductible, impact, fichier et
ligne, puis correction minimale.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
