# Brief d'audit Claude - gestion privée des communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et la limite
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `api/communications/admin/index.ts`
- `api/communications/admin/[id]/index.ts`
- `src/pages/admin/CommunicationsPage.tsx`
- `scripts/test-communication-ui.mjs`
- `scripts/test-communication-review.mjs`

## Mission proposée

Auditer en lecture seule la recherche locale, les filtres, la sélection, les
états vides, l'historique borné, le cloisonnement établissement, les données
retournées par les deux API et le rendu clavier/320 px. Vérifier qu'aucun corps
n'entre dans la recherche, qu'aucune ancienne version complète n'est exposée et
qu'aucune action d'audience, publication ou envoi n'a été ajoutée. Ne modifier
aucun fichier et ne manipuler aucune donnée réelle.

## Sortie attendue

- constats classés par sévérité avec fichier et ligne ;
- scénario minimal de reproduction ;
- mention explicite si aucun défaut bloquant n'est trouvé ;
- risques résiduels séparés des défauts confirmés.
