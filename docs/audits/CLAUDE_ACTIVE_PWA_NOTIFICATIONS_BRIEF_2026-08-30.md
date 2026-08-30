# Brief d'audit Claude - alertes PWA de session active

## Mission proposée

Auditer uniquement l'activation volontaire des alertes dans `Mes demandes`, la
réconciliation des états et réponses, le clic du service worker et le masquage
des réponses API non JSON. Rechercher les demandes de permission automatiques,
les doublons, les retours d'état obsolètes, les données sensibles sur écran
verrouillé, les identifiants dans l'URL et les débordements à 320 px.

## Fichiers à examiner

- `shared/support-active-notification.ts`
- `shared/json-api-response.ts`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `src/pages/prototype/lycee-connect.css`
- `public/sw.js`
- `scripts/test-support-active-notification.mjs`
- `scripts/test-json-api-response.mjs`

## Sortie attendue

Constats classés par gravité avec fichier et ligne, risques résiduels, tests
manquants et verdict limité à la preview. Ne demander aucune donnée réelle et ne
proposer aucune activation de production.

## État d'exécution

Non exécuté. Le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis ; aucun jeton externe n'a été consommé.
