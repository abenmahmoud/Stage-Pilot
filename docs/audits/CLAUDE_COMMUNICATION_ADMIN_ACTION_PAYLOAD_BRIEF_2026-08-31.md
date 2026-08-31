# Brief Claude - confirmations des actions Communications

## Statut

Audit externe non exécuté. Zéro jeton externe consommé.

## Mission préparée

Relire en lecture seule les validateurs de fiche, historique et mutations ainsi
que leur branchement avant les effets visibles. Chercher un faux succès accepté,
une variante serveur oubliée, un identifiant substituable, une relation de
version trop faible ou trop stricte, un secret affichable, une fuite de champs
internes et une course de sélection non couverte.

## Périmètre

- `shared/communication-admin-action-payload.ts`
- `src/pages/admin/CommunicationsPage.tsx`
- `api/communications/admin/index.ts`
- `api/communications/admin/[id]/index.ts`
- `api/communications/admin/[id]/review.ts`
- `api/communications/admin/[id]/approve.ts`
- `api/communications/admin/[id]/publish.ts`
- `api/communications/admin/assist.ts`
- `api/communications/admin/templates.ts`
- `api/communications/admin/failures/[id]/retry.ts`
- `scripts/test-communication-admin-action-payload.mjs`

Interdire tout accès à Vercel, Supabase, aux variables, aux données réelles et
aux autres dépôts. Ne lancer ni mutation, ni envoi, ni publication, ni webhook.
Arrêter après les constats classés et les tests manquants. Le fournisseur, le
modèle et le plafond de consommation doivent être confirmés avant exécution.
