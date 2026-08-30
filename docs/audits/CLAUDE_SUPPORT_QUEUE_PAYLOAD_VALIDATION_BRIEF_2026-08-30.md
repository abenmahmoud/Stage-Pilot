# Brief d'audit Claude - contrat de réponse de file

## Mission proposée

Auditer uniquement la validation du JSON reçu par la file agent. Rechercher un
champ utilisé dans le rendu mais non vérifié, une valeur numérique non bornée ou
une réponse partielle capable d'effacer la file existante ou de planter l'écran.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-queue-payload-validation.mjs`

## Sortie attendue

Constats classés par gravité avec charge utile minimale, impact, fichier et
ligne, puis correction minimale.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
