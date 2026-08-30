# Brief d'audit Claude - réponses JSON bornées

## Mission préparée

Auditer le lecteur navigateur commun qui borne les réponses JSON avant analyse
et son plafond éditorial explicite.

## Fichiers à examiner

- `shared/json-api-response.ts`
- `src/pages/prototype/public-content-client.ts`
- `scripts/test-json-api-response.mjs`
- `scripts/test-public-content-client-payload.mjs`
- `package.json`

## Questions

1. Le lecteur arrête-t-il réellement un flux sans taille annoncée ?
2. Une valeur `Content-Length` absente, fausse ou démesurée contourne-t-elle le
   plafond effectif ?
3. Les messages serveur ou corps invalides peuvent-ils être exposés à l'usager ?
4. Les plafonds de 4 Mio et 16 Mio sont-ils cohérents avec les contrats validés ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
