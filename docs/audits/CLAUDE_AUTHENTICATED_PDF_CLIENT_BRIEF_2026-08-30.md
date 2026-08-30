# Brief d'audit Claude - client PDF authentifié

## Mission préparée

Auditer en lecture seule l'ouverture des PDF authentifiés dans le navigateur,
sans télécharger de document réel ni accéder à la production.

## Fichiers à examiner

- `shared/api-file-response.ts`
- `shared/json-api-response.ts`
- `src/lib/api.ts`
- `scripts/test-json-api-response.mjs`
- `api/grand-oral/[id]/pdf.ts`

## Questions

1. Un fichier surdimensionné peut-il être entièrement chargé en mémoire ?
2. Une réponse HTML ou un faux PDF peut-il être ouvert comme document ?
3. Une URL HTTP, tierce, avec identifiants ou fragment peut-elle être suivie ?
4. La nouvelle fenêtre peut-elle conserver un accès à l'application appelante ?
5. Les erreurs API restent-elles bornées et sans détail technique exposé ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
