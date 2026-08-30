# Brief d'audit Claude - réponses auxiliaires agent

## Mission préparée

Auditer la validation des modèles de réponse et la restriction des liens
temporaires de pièces jointes dans la console agent.

## Fichiers à examiner

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `scripts/test-support-agent-auxiliary-payloads.mjs`
- `api/support/agent/templates.ts`
- `api/support/agent/attachments/[id].ts`

## Questions

1. Un modèle mal formé peut-il atteindre le rendu ou être ajouté après création ?
2. Un schéma non HTTPS, une autre origine ou un chemin non signé peut-il s'ouvrir ?
3. La fenêtre externe peut-elle conserver un accès à la console agent ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
