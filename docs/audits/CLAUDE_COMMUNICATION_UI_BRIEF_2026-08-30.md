# Brief d'audit Claude - interface du centre de communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : aucun modèle Claude exact ni
plafond de consommation n'est attaché à cette mission.

## Périmètre strict

- `src/pages/admin/CommunicationsPage.tsx`
- `src/lib/feature-flags.ts`
- route ajoutée dans `src/App.tsx`
- entrée conditionnelle dans `src/components/AppLayout.tsx`
- `scripts/test-communication-ui.mjs`

## Mission proposée

Vérifier que l'écran reste fermé par défaut, que le rôle client correspond au
rôle serveur et que seul le dépôt manuel est opérationnel. Chercher une fuite
de brouillon, une action de publication/envoi accessible, un champ de
destinataire, une fausse réussite, un débordement à 320 px ou un obstacle au
clavier. Ne modifier aucun fichier, aucune variable Vercel et aucune donnée.

## Sortie attendue

- constats classés par sévérité avec fichier et ligne ;
- scénario minimal de reproduction ;
- mention explicite si aucun défaut bloquant n'est trouvé ;
- risques résiduels séparés des défauts confirmés.
