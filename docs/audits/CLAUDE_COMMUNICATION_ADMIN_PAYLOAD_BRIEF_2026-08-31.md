# Brief Claude - contrats de la console Communications

## Statut

Audit externe non exécuté. Zéro jeton externe consommé.

## Mission préparée

Relire en lecture seule les quatre validateurs du chargement initial, les
projections des routes productrices, leur intégration avant les changements
d'état et les tests adverses. Rechercher une réponse acceptée hors contrat, une
relation métier trop permissive ou trop stricte, un secret rendu visible, une
liste partiellement appliquée, un contournement de limite ou un écart entre SQL
et navigateur.

## Périmètre

- `shared/communication-admin-payload.ts`
- `src/pages/admin/CommunicationsPage.tsx`
- `api/communications/admin/index.ts`
- `api/communications/admin/templates.ts`
- `api/communications/admin/failures/index.ts`
- `api/communications/admin/inbound/index.ts`
- `scripts/test-communication-admin-payload.mjs`

Interdire tout accès à Vercel, Supabase, aux variables, aux données réelles et
aux autres dépôts. Ne lancer ni envoi, ni entrant, ni publication. Arrêter après
les constats classés et les tests manquants. Le fournisseur, le modèle et le
plafond de consommation doivent être confirmés avant exécution.
