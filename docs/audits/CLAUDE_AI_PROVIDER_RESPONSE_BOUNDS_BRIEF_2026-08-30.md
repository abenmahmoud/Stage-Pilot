# Brief d'audit Claude - réponses du fournisseur IA

## Mission préparée

Auditer en lecture seule la lecture bornée des réponses du fournisseur IA pour
les quatre parcours concernés, sans exécuter d'appel externe.

## Fichiers à examiner

- `shared/ai-provider-response.ts`
- `shared/json-api-response.ts`
- `api/_shared/support-agent.ts`
- `api/_shared/support-translation.ts`
- `api/content/admin/assist.ts`
- `api/communications/admin/assist.ts`
- `scripts/test-ai-provider-response-bounds.mjs`

## Questions

1. Un flux sans `Content-Length` peut-il dépasser 2 Mo sans être annulé ?
2. Un consommateur conserve-t-il une lecture JSON directe non bornée ?
3. Une réponse primitive, invalide ou tronquée peut-elle atteindre le parseur métier ?
4. Les replis existants de l'assistant et les erreurs sûres des autres parcours
   restent-ils effectifs ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
