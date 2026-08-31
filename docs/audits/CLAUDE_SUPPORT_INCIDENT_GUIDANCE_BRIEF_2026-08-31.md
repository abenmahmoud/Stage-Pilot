# Brief Claude - conduite à tenir en cas d'incident

## Statut

Audit externe non exécuté. Zéro jeton externe consommé.

## Mission préparée

Relire en lecture seule la procédure déterministe, son intégration dans la vue
Direction et ses tests. Rechercher une fausse confirmation, une transmission
implicite, une donnée personnelle dans le résumé copié, une consigne dangereuse,
une branche non couverte ou une ambiguïté entre surveillance et intervention.

## Périmètre

- `shared/support-incident-guidance.ts`
- `src/pages/admin/SupportOperationsPage.tsx`
- `scripts/test-support-incident-guidance.mjs`
- les contrats de santé producteurs, en lecture seule

Interdire tout accès à Vercel, Supabase, aux variables, aux données réelles et
aux autres dépôts. Arrêter après les constats classés et les tests manquants. Le
modèle et le plafond de consommation doivent être confirmés avant lancement.
