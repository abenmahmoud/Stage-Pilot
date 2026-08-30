# Brief d'audit Claude - client API authentifié borné

## Mission préparée

Auditer le raccordement de `apiFetch` au lecteur JSON borné commun pour les
réponses réussies et les erreurs.

## Fichiers à examiner

- `src/lib/api.ts`
- `shared/json-api-response.ts`
- `scripts/test-json-api-response.mjs`

## Questions

1. Une branche succès ou erreur peut-elle encore appeler `res.json()` sans
   plafond ?
2. Les erreurs serveur conservent-elles seulement un message borné et sûr ?
3. Les réponses sans JSON restent-elles compatibles sans masquer une erreur ?
4. Un flux surdimensionné est-il interrompu avant d'atteindre les consommateurs ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
