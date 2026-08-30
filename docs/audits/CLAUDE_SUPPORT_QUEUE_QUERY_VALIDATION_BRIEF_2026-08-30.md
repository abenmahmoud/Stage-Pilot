# Brief d'audit Claude - validation des filtres de file

## Mission proposée

Auditer uniquement la validation des paramètres `status`, `assigned`, `urgent`,
`callback`, `duplicate` et `overdue` de la file agent, ainsi que le refus des
clés répétées. Vérifier qu'une valeur inconnue échoue avant toute requête SQL et
qu'aucun filtre valide existant n'est cassé.

## Fichiers à examiner

- `api/support/agent/requests/index.ts`
- `scripts/test-support-queue-query-validation.mjs`

## Sortie attendue

Constats classés par gravité avec fichier et ligne, scénario reproductible,
impact sur le cloisonnement et correction minimale.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
