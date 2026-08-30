# Brief d'audit Claude - réponse navigateur de l'assistant

## Mission préparée

Auditer la validation navigateur de la réponse structurée de l'assistant et de
son reçu de routage avant tout affichage ou réemploi.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `api/support/assistant.ts`
- `shared/support-assistant-routing-receipt.ts`
- `scripts/test-support-assistant-client-payload.mjs`

## Questions

1. Une catégorie, une action ou un périmètre inconnu peut-il atteindre l'écran ?
2. Les textes, listes, sources et compteurs sont-ils suffisamment bornés ?
3. Un reçu partiel, démesuré, mal formé ou hors de sa fenêtre peut-il être
   conservé par le navigateur ?
4. Le repli local reste-t-il disponible sans élargir les droits de l'usager ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
